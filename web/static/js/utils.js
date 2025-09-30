// Utility functions

// Message formatting with placeholders
function formatMessage(template, ...args) {
    return template.replace(/{(\d+)}/g, (match, index) => {
        return typeof args[index] !== 'undefined' ? args[index] : match;
    });
}
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (bytes === 0) return window.AppConstants.UI_TEXT.zeroBytes;
    const k = window.AppConstants.UI_CONFIG.fileSizeUnit;
    const sizes = [window.AppConstants.UI_TEXT.bytes, window.AppConstants.UI_TEXT.kb, window.AppConstants.UI_TEXT.mb, window.AppConstants.UI_TEXT.gb];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatRelativeDate(timestamp) {
    // timestamp is expected to be Unix timestamp in milliseconds
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / window.AppConstants.UI_CONFIG.daysInMs);
    const diffHours = Math.floor(diffMs / window.AppConstants.UI_CONFIG.hoursInMs);
    const diffMinutes = Math.floor(diffMs / window.AppConstants.UI_CONFIG.minutesInMs);

    if (diffMinutes < 1) return window.AppConstants.UI_TEXT.now;
    if (diffMinutes < 60) return `${diffMinutes}${window.AppConstants.UI_TEXT.minutesAgo}`;
    if (diffHours < 24) return `${diffHours}${window.AppConstants.UI_TEXT.hoursAgo}`;
    if (diffDays < window.AppConstants.UI_CONFIG.weekInDays) return `${diffDays}${window.AppConstants.UI_TEXT.daysAgo}`;

    // More than a week ago
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}

function formatDateTimeMMDDYY(timestamp) {
    // timestamp is expected to be Unix timestamp in milliseconds
    const date = new Date(timestamp);

    // Format as mm/dd/yy hh:mm:ss (24h format)
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
}

function showError(message) {
    if (window.showError && window.showError !== showError) {
        window.showError(message);
    } else {
        alert(message);
    }
}

// Custom confirmation dialog
function showConfirmation(title, message, detailsHtml = null) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmation-modal');
        const titleElement = document.getElementById('confirmation-title');
        const messageElement = document.getElementById('confirmation-message');
        const detailsElement = document.getElementById('confirmation-details');
        const confirmButton = document.getElementById('confirmation-confirm');
        const cancelButton = document.getElementById('confirmation-cancel');

        // Set content
        titleElement.textContent = title;
        // Parse bold formatting in message
        const formattedMessage = message.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-black">$1</strong>');
        messageElement.innerHTML = formattedMessage.replace(/\n/g, '<br>');

        // Handle details section
        if (detailsHtml) {
            detailsElement.innerHTML = detailsHtml;
            detailsElement.style.display = 'block';
        } else {
            detailsElement.innerHTML = '';
            detailsElement.style.display = 'none';
        }

        // Show modal
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Handle clicks
        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
            }
        };

        const cleanup = () => {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
            confirmButton.removeEventListener('click', handleConfirm);
            cancelButton.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleEscape);
        };

        // Add event listeners
        confirmButton.addEventListener('click', handleConfirm);
        cancelButton.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleEscape);
    });
}

// URL formatting utilities - add these to utils.js

function shortenUrl(url, maxLength = window.AppConstants.UI_CONFIG.maxUrlDisplayLength) {
    try {
        const urlObj = new URL(url);
        let shortened = urlObj.hostname;
        
        // Add path if there's room
        if (urlObj.pathname !== '/' && shortened.length < maxLength - 5) {
            const pathPart = urlObj.pathname.substring(0, maxLength - shortened.length - 3);
            shortened += pathPart;
            if (urlObj.pathname.length > pathPart.length) {
                shortened += '...';
            }
        }
        
        // If still too long, truncate hostname
        if (shortened.length > maxLength) {
            shortened = shortened.substring(0, maxLength - 3) + '...';
        }
        
        return shortened;
    } catch (e) {
        // If URL parsing fails, just truncate the original
        return url.length > maxLength ? url.substring(0, maxLength - 3) + window.AppConstants.UI_TEXT.ellipsis : url;
    }
}

function formatTextWithUrls(text) {
    // URL regex - same as used in link preview
    const urlRegex = /https?:\/\/[^\s\)]+/g;

    // Replace URLs with formatted links
    return text.replace(urlRegex, (url) => {
        const shortUrl = shortenUrl(url);
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 font-semibold hover:underline transition-colors">${escapeHtml(shortUrl)}</a>`;
    });
}

function getFileIcon(fileExtension) {
    const ext = fileExtension.toLowerCase();

    // Programming/Code files
    if (['js', 'ts', 'jsx', 'tsx', 'vue', 'react'].includes(ext)) return 'fa-code';
    if (['html', 'htm', 'xml'].includes(ext)) return 'fa-code';
    if (['css', 'scss', 'sass', 'less'].includes(ext)) return 'fa-palette';
    if (['py', 'python'].includes(ext)) return 'fa-code';
    if (['java', 'jar'].includes(ext)) return 'fa-coffee';
    if (['c', 'cpp', 'cc', 'h', 'hpp'].includes(ext)) return 'fa-code';
    if (['cs', 'csharp'].includes(ext)) return 'fa-code';
    if (['php'].includes(ext)) return 'fa-code';
    if (['rb', 'ruby'].includes(ext)) return 'fa-gem';
    if (['go'].includes(ext)) return 'fa-code';
    if (['rs', 'rust'].includes(ext)) return 'fa-code';
    if (['swift'].includes(ext)) return 'fa-code';
    if (['kt', 'kotlin'].includes(ext)) return 'fa-code';
    if (['dart'].includes(ext)) return 'fa-code';
    if (['r'].includes(ext)) return 'fa-chart-line';
    if (['m', 'mm'].includes(ext)) return 'fa-code';
    if (['scala'].includes(ext)) return 'fa-code';
    if (['clj', 'clojure'].includes(ext)) return 'fa-code';
    if (['hs', 'haskell'].includes(ext)) return 'fa-code';
    if (['lua'].includes(ext)) return 'fa-code';
    if (['perl', 'pl'].includes(ext)) return 'fa-code';
    if (['sh', 'bash', 'zsh', 'fish'].includes(ext)) return 'fa-terminal';
    if (['bat', 'cmd'].includes(ext)) return 'fa-terminal';
    if (['ps1', 'powershell'].includes(ext)) return 'fa-terminal';

    // Documents
    if (['pdf'].includes(ext)) return 'fa-file-pdf';
    if (['doc', 'docx'].includes(ext)) return 'fa-file-word';
    if (['xls', 'xlsx'].includes(ext)) return 'fa-file-excel';
    if (['ppt', 'pptx'].includes(ext)) return 'fa-file-powerpoint';
    if (['txt', 'text'].includes(ext)) return 'fa-file-alt';
    if (['rtf'].includes(ext)) return 'fa-file-alt';
    if (['odt', 'ods', 'odp'].includes(ext)) return 'fa-file-alt';

    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif'].includes(ext)) return 'fa-image';

    // Audio
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'].includes(ext)) return 'fa-file-audio';

    // Video
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext)) return 'fa-file-video';

    // Archives
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) return 'fa-file-archive';

    // Data/Config files
    if (['json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf'].includes(ext)) return 'fa-cog';
    if (['csv', 'tsv'].includes(ext)) return 'fa-table';
    if (['sql', 'db', 'sqlite'].includes(ext)) return 'fa-database';

    // Markdown/Documentation
    if (['md', 'markdown', 'rst'].includes(ext)) return 'fa-file-alt';

    // Default
    return 'fa-file';
}