// File Management
function addFileToSelection(file) {
    if (selectedFiles.size >= 20) {
        showError('Maximum 20 files allowed per post');
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

function updateFilePreview() {
    const container = document.getElementById('file-preview-container');
    container.innerHTML = '';

    if (selectedFiles.size === 0) return;

    const filesArray = Array.from(selectedFiles.entries());
    filesArray.forEach(([fileId, file]) => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'flex items-center justify-between bg-gray-50 border border-gray-200 rounded p-3';

        const isImage = file.type.startsWith('image/');
        let preview = '';

        if (isImage) {
            const objectUrl = URL.createObjectURL(file);
            preview = `<img src="${objectUrl}" class="w-12 h-12 object-cover rounded mr-3">`;
        } else {
            preview = `<div class="w-12 h-12 bg-gray-200 rounded mr-3 flex items-center justify-center">
                <i class="fas fa-file text-gray-500"></i>
            </div>`;
        }

        fileDiv.innerHTML = `
            <div class="flex items-center">
                ${preview}
                <div>
                    <p class="text-sm font-medium text-gray-900 truncate" style="max-width: 200px;">${file.name}</p>
                    <p class="text-xs text-gray-500">${formatFileSize(file.size)}</p>
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
        label.className = 'text-sm font-medium text-gray-700 mb-2';
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