// File Management
async function addFileToSelection(file) {
    const settings = window.currentSettings || await loadAppSettings();

    if (selectedFiles.size >= settings.maxFilesPerPost) {
        showError(formatMessage(window.AppConstants.USER_MESSAGES.error.maxFilesExceeded, settings.maxFilesPerPost));
        return false;
    }

    // Check file size
    const maxFileSizeBytes = settings.maxFileSizeMB * window.AppConstants.UI_CONFIG.fileSizeUnit * window.AppConstants.UI_CONFIG.fileSizeUnit;
    if (file.size > maxFileSizeBytes) {
        showError(formatMessage(window.AppConstants.USER_MESSAGES.error.fileSizeExceeded, file.name, settings.maxFileSizeMB));
        return false;
    }

    const fileId = ++fileCounter;
    selectedFiles.set(fileId, file);
    updateFilePreview();
    return true;
}

function removeFileFromSelection(fileId) {
    selectedFiles.delete(fileId);
    updateFilePreview();
}

// Make function globally accessible for onclick handlers
window.removeFileFromSelection = removeFileFromSelection;

function updateFilePreview() {
    const container = document.getElementById('file-preview-container');
    container.innerHTML = '';

    if (selectedFiles.size === 0) return;

    const filesArray = Array.from(selectedFiles.entries());
    filesArray.forEach(([fileId, file]) => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'flex items-center justify-between bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3';

        const isImage = file.type.startsWith('image/');
        let preview = '';

        if (isImage) {
            const objectUrl = URL.createObjectURL(file);
            preview = `<img src="${objectUrl}" class="w-12 h-12 object-cover rounded mr-3">`;
        } else {
            preview = `<div class="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded mr-3 flex items-center justify-center">
                <i class="fas fa-file text-gray-500 dark:text-gray-400"></i>
            </div>`;
        }

        fileDiv.innerHTML = `
            <div class="flex items-center">
                ${preview}
                <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" style="max-width: ${window.AppConstants.UI_CONFIG.maxFilenameDisplay}px;">${file.name}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${formatFileSize(file.size)}</p>
                </div>
            </div>
            <button type="button" onclick="removeFileFromSelection(${fileId})" class="text-red-600 hover:text-red-800 p-1">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(fileDiv);
    });
}

function updatePastedFilesDisplay() {
    const container = document.getElementById('pasted-files-display');
    container.innerHTML = '';

    if (window.pastedFiles && window.pastedFiles.length > 0) {
        const label = document.createElement('div');
        label.className = 'text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';
        label.textContent = 'Pasted Images:';
        container.appendChild(label);

        window.pastedFiles.forEach((file, index) => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'flex items-center justify-between bg-blue-50 border border-blue-200 rounded p-2 mb-1';
            fileDiv.innerHTML = `
                <span class="text-sm text-blue-700">
                    <i class="fas fa-image mr-2"></i>${file.name}
                </span>
                <button type="button" onclick="removePastedFile(${index})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(fileDiv);
        });
    }
}

function removePastedFile(index) {
    if (window.pastedFiles && window.pastedFiles.length > index) {
        window.pastedFiles.splice(index, 1);
        updatePastedFilesDisplay();
    }
}

// Make function globally accessible for onclick handlers
window.removePastedFile = removePastedFile;

// Modal file management functions
async function addModalFileToSelection(file) {
    const settings = window.currentSettings || await loadAppSettings();

    if (modalSelectedFiles.size >= settings.maxFilesPerPost) {
        showError(formatMessage(window.AppConstants.USER_MESSAGES.error.maxFilesExceeded, settings.maxFilesPerPost));
        return false;
    }

    // Check file size
    const maxFileSizeBytes = settings.maxFileSizeMB * window.AppConstants.UI_CONFIG.fileSizeUnit * window.AppConstants.UI_CONFIG.fileSizeUnit;
    if (file.size > maxFileSizeBytes) {
        showError(formatMessage(window.AppConstants.USER_MESSAGES.error.fileSizeExceeded, file.name, settings.maxFileSizeMB));
        return false;
    }

    const fileId = ++modalFileCounter;
    modalSelectedFiles.set(fileId, file);
    updateModalFilePreview();
    return true;
}

function removeModalFileFromSelection(fileId) {
    modalSelectedFiles.delete(fileId);
    updateModalFilePreview();
}

// Expose to global scope for inline onclick handlers
window.removeModalFileFromSelection = removeModalFileFromSelection;

function updateModalFilePreview() {
    const container = document.getElementById('modal-file-preview-container');
    const list = document.getElementById('modal-file-preview-list');

    if (modalSelectedFiles.size === 0 && (!window.modalPastedFiles || window.modalPastedFiles.length === 0)) {
        container.style.display = 'none';
        updateModalFileSizeDisplay();
        return;
    }

    container.style.display = 'block';
    list.innerHTML = '';

    // Add regular files
    const filesArray = Array.from(modalSelectedFiles.entries());
    filesArray.forEach(([fileId, file]) => {
        const fileElement = createModalFilePreviewElement(fileId, file, 'file');
        list.appendChild(fileElement);
    });

    // Add pasted files
    if (window.modalPastedFiles && window.modalPastedFiles.length > 0) {
        window.modalPastedFiles.forEach((file, index) => {
            const fileElement = createModalFilePreviewElement(index, file, 'pasted');
            list.appendChild(fileElement);
        });
    }

    updateModalFileSizeDisplay();
    updateModalNavigationButtons();
}

function createModalFilePreviewElement(id, file, type) {
    const fileDiv = document.createElement('div');
    const fileSizeText = formatFileSize(file.size);
    const tooltipText = `${file.name} • ${fileSizeText}`;
    const isImage = file.type.startsWith('image/');

    const removeHandler = type === 'pasted' ? `removeModalPastedFile(${id})` : `removeModalFileFromSelection(${id})`;
    const fileExtension = file.name.split('.').pop() || 'FILE';

    // Set the fileDiv to be a flex column container with fixed width
    fileDiv.className = 'flex flex-col flex-shrink-0';

    if (isImage) {
        const objectUrl = URL.createObjectURL(file);
        fileDiv.innerHTML = `
            <div class="relative w-20 h-20 group cursor-pointer" onclick="openModalImagePreview('${file.name}', '${objectUrl}'); event.stopPropagation();" title="${tooltipText}">
                <img src="${objectUrl}"
                     alt="${file.name}"
                     class="w-full h-full object-cover rounded-lg border hover:opacity-90 transition-opacity"
                     onload="window.URL.revokeObjectURL(this.src)">
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                    <div class="absolute bottom-0 left-0 right-0 p-1">
                        <p class="text-white text-xs truncate leading-tight">${file.name}</p>
                        <p class="text-white/80 text-xs">${fileSizeText}</p>
                    </div>
                </div>
            </div>
            <button type="button" onclick="${removeHandler}; event.stopPropagation();"
                    class="text-xs text-red-600 hover:text-red-800 mt-1 block text-center">
                Delete
            </button>
        `;
    } else {
        const fileIcon = getFileIcon(fileExtension);
        fileDiv.innerHTML = `
            <div class="relative w-20 h-20 group cursor-pointer" title="${tooltipText}">
                <div class="w-full h-full bg-gray-100 dark:bg-gray-800 border dark:border-gray-700 rounded-lg flex flex-col items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <i class="fas ${fileIcon} text-2xl text-gray-600 dark:text-gray-400 mb-1"></i>
                    <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">${fileExtension.toUpperCase()}</span>
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                    <div class="absolute bottom-0 left-0 right-0 p-1">
                        <p class="text-white text-xs truncate leading-tight">${file.name}</p>
                        <p class="text-white/80 text-xs">${fileSizeText}</p>
                    </div>
                </div>
            </div>
            <button type="button" onclick="${removeHandler}; event.stopPropagation();"
                    class="text-xs text-red-600 hover:text-red-800 mt-1 block text-center">
                Delete
            </button>
        `;
    }

    // Add click event listener for images
    if (isImage) {
        fileDiv.addEventListener('click', function(e) {
            if (!e.target.closest('button')) {
                const objectUrl = URL.createObjectURL(file);
                openModalImagePreview(file.name, objectUrl);
            }
        });
    }

    return fileDiv;
}

function generateFilePreview(file) {
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const isCode = isCodeFile(file.name);
    const isArchive = isArchiveFile(file.type);
    const isDocument = isDocumentFile(file.type);

    if (isImage) {
        const objectUrl = URL.createObjectURL(file);
        return `<img src="${objectUrl}" class="w-full h-full object-cover rounded-lg border" onload="window.URL.revokeObjectURL(this.src)">`;
    } else if (isPDF) {
        return `<div class="w-full h-full bg-red-50 flex flex-col items-center justify-center">
            <i class="fas fa-file-pdf text-red-500 text-lg mb-1"></i>
            <span class="text-xs text-red-600 font-medium">PDF</span>
        </div>`;
    } else if (isVideo) {
        return `<div class="w-full h-full bg-purple-50 flex flex-col items-center justify-center">
            <i class="fas fa-play-circle text-purple-500 text-lg mb-1"></i>
            <span class="text-xs text-purple-600 font-medium">${getVideoFormat(file.type)}</span>
        </div>`;
    } else if (isAudio) {
        return `<div class="w-full h-full bg-green-50 flex flex-col items-center justify-center">
            <i class="fas fa-music text-green-500 text-lg mb-1"></i>
            <span class="text-xs text-green-600 font-medium">${getAudioFormat(file.type)}</span>
        </div>`;
    } else if (isCode) {
        const lang = getCodeLanguage(file.name);
        return `<div class="w-full h-full bg-blue-50 flex flex-col items-center justify-center">
            <i class="fas fa-code text-blue-500 text-lg mb-1"></i>
            <span class="text-xs text-blue-600 font-medium">${lang}</span>
        </div>`;
    } else if (isArchive) {
        return `<div class="w-full h-full bg-orange-50 flex flex-col items-center justify-center">
            <i class="fas fa-file-archive text-orange-500 text-lg mb-1"></i>
            <span class="text-xs text-orange-600 font-medium">ZIP</span>
        </div>`;
    } else if (isDocument) {
        return `<div class="w-full h-full bg-indigo-50 flex flex-col items-center justify-center">
            <i class="fas fa-file-alt text-indigo-500 text-lg mb-1"></i>
            <span class="text-xs text-indigo-600 font-medium">DOC</span>
        </div>`;
    } else {
        return `<div class="w-full h-full bg-gray-50 dark:bg-gray-800 flex flex-col items-center justify-center">
            <i class="fas fa-file text-gray-500 dark:text-gray-400 text-lg mb-1"></i>
            <span class="text-xs text-gray-600 dark:text-gray-400 font-medium">FILE</span>
        </div>`;
    }
}

function isCodeFile(filename) {
    return window.AppConstants.FILE_EXTENSIONS.code.some(ext => filename.toLowerCase().endsWith(ext));
}

function isArchiveFile(type) {
    return ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar', 'application/gzip'].includes(type);
}

function isDocumentFile(type) {
    return ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(type);
}

function getCodeLanguage(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const langMap = {
        'js': 'JS', 'ts': 'TS', 'jsx': 'JSX', 'tsx': 'TSX', 'py': 'PY', 'java': 'JAVA',
        'cpp': 'C++', 'c': 'C', 'h': 'C/H', 'css': 'CSS', 'html': 'HTML', 'php': 'PHP',
        'rb': 'RUBY', 'go': 'GO', 'rs': 'RUST', 'swift': 'SWIFT', 'kt': 'KOTLIN',
        'scala': 'SCALA', 'sql': 'SQL', 'json': 'JSON', 'xml': 'XML', 'yaml': 'YAML',
        'yml': 'YAML', 'sh': 'BASH', 'bash': 'BASH', 'ps1': 'PS', 'r': 'R', 'm': 'MATLAB',
        'vue': 'VUE', 'svelte': 'SVELTE'
    };
    return langMap[ext] || 'CODE';
}

function getVideoFormat(type) {
    const typeLower = type.toLowerCase();
    for (const [format, label] of Object.entries(window.AppConstants.VIDEO_FORMAT_MAP)) {
        if (typeLower.includes(format)) return label;
    }
    return 'VIDEO';
}

function getAudioFormat(type) {
    const typeLower = type.toLowerCase();
    for (const [format, label] of Object.entries(window.AppConstants.AUDIO_FORMAT_MAP)) {
        if (typeLower.includes(format)) return label;
    }
    return 'AUDIO';
}

function updateModalFileSizeDisplay() {
    const display = document.getElementById('modal-file-size-display');
    let totalSize = 0;
    let fileCount = 0;

    // Add regular files
    modalSelectedFiles.forEach(file => {
        totalSize += file.size;
        fileCount++;
    });

    // Add pasted files
    if (window.modalPastedFiles && window.modalPastedFiles.length > 0) {
        window.modalPastedFiles.forEach(file => {
            totalSize += file.size;
            fileCount++;
        });
    }

    if (fileCount === 0) {
        display.style.display = 'none';
    } else {
        display.style.display = 'block';
        const sizeText = formatFileSize(totalSize);
        display.innerHTML = `<i class="fas fa-paperclip text-xs mr-1"></i>${fileCount} file${fileCount > 1 ? 's' : ''} • ${sizeText}`;
    }
}

function updateModalPastedFilesDisplay() {
    // This function is now integrated with updateModalFilePreview
    updateModalFilePreview();
}

function removeModalPastedFile(index) {
    if (window.modalPastedFiles && window.modalPastedFiles.length > index) {
        window.modalPastedFiles.splice(index, 1);
        updateModalFilePreview();
    }
}

// Modal attachment navigation functions
function updateModalNavigationButtons() {
    const container = document.getElementById('modal-file-preview-list');
    const leftBtn = document.getElementById('modal-file-prev');
    const rightBtn = document.getElementById('modal-file-next');
    const counter = document.getElementById('modal-file-counter');

    if (!container || !leftBtn || !rightBtn || !counter) return;

    // Calculate total file count
    const totalFiles = modalSelectedFiles.size + (window.modalPastedFiles ? window.modalPastedFiles.length : 0);

    // Update counter
    if (totalFiles === 0) {
        counter.textContent = '0 / 0';
        leftBtn.disabled = true;
        rightBtn.disabled = true;
        return;
    }

    // For now, we'll show the total count. In a future enhancement, we could track visible items
    counter.textContent = `${totalFiles} / ${totalFiles}`;

    function updateButtonVisibility() {
        const canScrollLeft = container.scrollLeft > 0;
        const canScrollRight = container.scrollLeft < (container.scrollWidth - container.clientWidth);

        leftBtn.disabled = !canScrollLeft;
        rightBtn.disabled = !canScrollRight;
    }

    // Remove existing listener to avoid duplicates
    container.removeEventListener('scroll', container.updateButtonVisibility);
    container.updateButtonVisibility = updateButtonVisibility;
    container.addEventListener('scroll', updateButtonVisibility);
    updateButtonVisibility();
}

function scrollModalAttachments(direction) {
    const container = document.getElementById('modal-file-preview-list');
    if (!container) return;

    const scrollAmount = 200; // pixels to scroll
    container.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
    });
}

// Make function globally accessible for onclick handlers
window.scrollModalAttachments = scrollModalAttachments;

// Function to open modal image preview using the existing image viewer
function openModalImagePreview(filename, url) {
    // Set up single image for viewer
    window.currentImageGallery = [{
        url: url,
        filename: filename
    }];
    window.currentImageIndex = 0;

    const modal = document.getElementById('image-viewer-modal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Update the viewer with our image
    const img = document.getElementById('viewer-image');
    const filenameElement = document.getElementById('viewer-filename');
    const counter = document.getElementById('viewer-counter');

    img.src = url;
    filenameElement.textContent = filename;
    counter.textContent = ''; // Single image, no counter

    // Hide navigation buttons for single image
    document.getElementById('viewer-prev').style.display = 'none';
    document.getElementById('viewer-next').style.display = 'none';
}

// Make function globally accessible
window.openModalImagePreview = openModalImagePreview;