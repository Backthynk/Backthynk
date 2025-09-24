// File upload text updater
async function updateFileUploadText() {
    const fileUploadText = document.getElementById('file-upload-text');
    if (!fileUploadText) return;

    const settings = await loadAppSettings(true);
    fileUploadText.textContent = `Or drag and drop files here (max ${settings.maxFilesPerPost} files)`;
}

// Initialize file upload text when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    updateFileUploadText();
});