// Settings functionality
let currentSettings = {};
let originalSettings = {};

function initializeSettings() {
    // Add event listeners
    document.getElementById('settings-btn').addEventListener('click', showSettingsPageEvent);
    document.getElementById('settings-back-btn').addEventListener('click', hideSettingsPage);
    document.getElementById('cancel-settings-btn').addEventListener('click', cancelSettings);
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
    document.getElementById('reset-settings-btn').addEventListener('click', resetToDefaults);
    document.getElementById('retroactivePostingEnabled').addEventListener('change', toggleRetroactiveTimeFormatVisibility);
}

function toggleRetroactiveTimeFormatVisibility() {
    const enabled = document.getElementById('retroactivePostingEnabled').checked;
    const timeFormatContainer = document.getElementById('retroactivePostingTimeFormatContainer');
    if (timeFormatContainer) {
        timeFormatContainer.style.display = enabled ? 'block' : 'none';
    }
}

async function showSettingsPageEvent() {
    window.router.navigate('/settings');
    showSettingsPage()
}

function hideSettingsPage() {
    // Use router to navigate back to home
    if (window.router) {
        if (typeof categories === 'undefined' || !categories || categories.length === 0){
            window.router.navigate('/');
            initializeApp()
        } else {
            router.handleCategoryRoute('/');
        }

    } else {
        // Fallback if router not available
        document.getElementById('settings-page').classList.add('hidden');
        document.querySelector('.container').style.display = 'block';
        clearSettingsStatus();
    }
}

async function loadSettings() {
    try {
        // Use the cached settings from the global app settings instead of making a new API call
        currentSettings = await loadAppSettings();
        originalSettings = { ...currentSettings };
    } catch (error) {
        console.error('Error loading settings:', error);
        throw error;
    }
}

function populateSettingsForm() {
    document.getElementById('maxContentLength').value = currentSettings.maxContentLength || window.AppConstants.DEFAULT_SETTINGS.maxContentLength;
    document.getElementById('siteTitle').value = currentSettings.siteTitle || 'Backthynk';
    document.getElementById('siteDescription').value = currentSettings.siteDescription || 'Personal micro blog platform';
    document.getElementById('activityEnabled').checked = currentSettings.activityEnabled !== undefined ? currentSettings.activityEnabled : window.AppConstants.DEFAULT_SETTINGS.activityEnabled;
    document.getElementById('fileStatsEnabled').checked = currentSettings.fileStatsEnabled !== undefined ? currentSettings.fileStatsEnabled : window.AppConstants.DEFAULT_SETTINGS.fileStatsEnabled;
    document.getElementById('retroactivePostingEnabled').checked = currentSettings.retroactivePostingEnabled !== undefined ? currentSettings.retroactivePostingEnabled : false;
    document.getElementById('markdownEnabled').checked = currentSettings.markdownEnabled !== undefined ? currentSettings.markdownEnabled : false;

    // File upload settings
    document.getElementById('fileUploadEnabled').checked = currentSettings.fileUploadEnabled !== undefined ? currentSettings.fileUploadEnabled : true;
    document.getElementById('maxFileSizeMB').value = currentSettings.maxFileSizeMB || window.AppConstants.DEFAULT_SETTINGS.maxFileSizeMB;
    document.getElementById('maxFilesPerPost').value = currentSettings.maxFilesPerPost || window.AppConstants.DEFAULT_SETTINGS.maxFilesPerPost;

    // Allowed extensions
    if (currentSettings.allowedFileExtensions && Array.isArray(currentSettings.allowedFileExtensions)) {
        document.getElementById('allowedFileExtensions').value = currentSettings.allowedFileExtensions.join(', ');
    } else {
        document.getElementById('allowedFileExtensions').value = 'jpg, jpeg, png, gif, webp, pdf, doc, docx, xls, xlsx, txt, zip, mp4, mov, avi';
    }

    // Set time format
    const timeFormat = currentSettings.retroactivePostingTimeFormat || window.AppConstants.DEFAULT_SETTINGS.retroactivePostingTimeFormat;
    document.getElementById('retroactivePostingTimeFormat').value = timeFormat;

    // Update character counters
    updateSiteDescriptionCounter();

    // Toggle time format visibility based on retroactive posting enabled state
    toggleRetroactiveTimeFormatVisibility();
}

function getSettingsFromForm() {
    // Parse allowed extensions
    const extensionsStr = document.getElementById('allowedFileExtensions').value;
    const allowedFileExtensions = extensionsStr
        .split(',')
        .map(ext => ext.trim().toLowerCase())
        .filter(ext => ext.length > 0);

    return {
        maxContentLength: parseInt(document.getElementById('maxContentLength').value),
        siteTitle: document.getElementById('siteTitle').value.trim(),
        siteDescription: document.getElementById('siteDescription').value.trim(),
        activityEnabled: document.getElementById('activityEnabled').checked,
        fileStatsEnabled: document.getElementById('fileStatsEnabled').checked,
        retroactivePostingEnabled: document.getElementById('retroactivePostingEnabled').checked,
        retroactivePostingTimeFormat: document.getElementById('retroactivePostingTimeFormat').value,
        markdownEnabled: document.getElementById('markdownEnabled').checked,
        fileUploadEnabled: document.getElementById('fileUploadEnabled').checked,
        maxFileSizeMB: parseInt(document.getElementById('maxFileSizeMB').value),
        maxFilesPerPost: parseInt(document.getElementById('maxFilesPerPost').value),
        allowedFileExtensions: allowedFileExtensions
    };
}

function validateSettings(settings) {
    const errors = [];

    if (settings.maxFileSizeMB < window.AppConstants.VALIDATION_LIMITS.minFileSizeMB || settings.maxFileSizeMB > window.AppConstants.VALIDATION_LIMITS.maxFileSizeMB) {
        errors.push(formatMessage(window.AppConstants.USER_MESSAGES.validation.fileSizeValidation, window.AppConstants.VALIDATION_LIMITS.minFileSizeMB, window.AppConstants.VALIDATION_LIMITS.maxFileSizeMB, (window.AppConstants.VALIDATION_LIMITS.maxFileSizeMB / 1024)));
    }

    if (settings.maxContentLength < window.AppConstants.VALIDATION_LIMITS.minContentLength || settings.maxContentLength > window.AppConstants.VALIDATION_LIMITS.maxContentLength) {
        errors.push(formatMessage(window.AppConstants.USER_MESSAGES.validation.contentLengthValidation, window.AppConstants.VALIDATION_LIMITS.minContentLength, window.AppConstants.VALIDATION_LIMITS.maxContentLength));
    }

    if (settings.maxFilesPerPost < window.AppConstants.VALIDATION_LIMITS.minFilesPerPost || settings.maxFilesPerPost > window.AppConstants.VALIDATION_LIMITS.maxFilesPerPost) {
        errors.push(formatMessage(window.AppConstants.USER_MESSAGES.validation.filesPerPostValidation, window.AppConstants.VALIDATION_LIMITS.minFilesPerPost, window.AppConstants.VALIDATION_LIMITS.maxFilesPerPost));
    }

    if (!settings.siteTitle || settings.siteTitle.length === 0 || settings.siteTitle.length > 100) {
        errors.push('Site title must be between 1 and 100 characters');
    }

    if (settings.siteDescription.length > 160) {
        errors.push('Site description must not exceed 160 characters');
    }

    return errors;
}

async function saveSettings() {
    const newSettings = getSettingsFromForm();
    const validationErrors = validateSettings(newSettings);

    if (validationErrors.length > 0) {
        showSettingsStatus(validationErrors.join('<br>'), 'error');
        return;
    }

    try {
        showSettingsStatus(window.AppConstants.USER_MESSAGES.info.savingSettings, 'info');

        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newSettings)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }

        const savedSettings = await response.json();
        currentSettings = savedSettings;
        originalSettings = { ...savedSettings };

        // Clear settings cache and refresh UI components
        clearSettingsCache();
        refreshUIWithNewSettings();

        // Check activity and file stats status in case they changed
        if (typeof checkActivityEnabled === 'function') {
            await checkActivityEnabled();
        }
        if (typeof checkFileStatsEnabled === 'function') {
            await checkFileStatsEnabled();
        }

        // Update markdown CSS visibility
        updateMarkdownCSS(savedSettings.markdownEnabled);

        // Update page title with new metadata
        if (savedSettings.siteTitle) {
            updatePageTitle(savedSettings.siteTitle);
        }

        showSuccess(window.AppConstants.USER_MESSAGES.success.settingsSaved);

        setTimeout(() => {
            if (window.router) {
                window.router.navigate('/');
            } else {
                hideSettingsPage();
            }
        }, window.AppConstants.UI_CONFIG.successMessageDelay);

    } catch (error) {
        console.error('Error saving settings:', error);
        showError(formatMessage(window.AppConstants.USER_MESSAGES.error.failedToSaveSettings, error.message));
    }
}

function cancelSettings() {
    // Restore original values
    populateSettingsForm();

    if (window.router) {
        window.router.navigate('/');
    } else {
        hideSettingsPage();
    }
}

function resetToDefaults() {
    if (confirm(window.AppConstants.USER_MESSAGES.info.resetSettingsConfirm)) {
        document.getElementById('maxFileSizeMB').value = window.AppConstants.DEFAULT_SETTINGS.maxFileSizeMB;
        document.getElementById('maxContentLength').value = window.AppConstants.DEFAULT_SETTINGS.maxContentLength;
        document.getElementById('maxFilesPerPost').value = window.AppConstants.DEFAULT_SETTINGS.maxFilesPerPost;
        // Storage path is not reset as it's read-only
        showSettingsStatus(window.AppConstants.USER_MESSAGES.info.settingsResetInfo, 'info');
    }
}

function showSettingsStatus(message, type = 'info') {
    const statusDiv = document.getElementById('settings-status');
    statusDiv.classList.remove('hidden');

    // Remove existing status classes
    statusDiv.classList.remove('text-green-600', 'text-red-600', 'text-blue-600', 'text-gray-600');

    // Add appropriate class based on type
    switch (type) {
        case 'success':
            statusDiv.classList.add('text-green-600');
            break;
        case 'error':
            statusDiv.classList.add('text-red-600');
            break;
        case 'info':
            statusDiv.classList.add('text-blue-600');
            break;
        default:
            statusDiv.classList.add('text-gray-600');
    }

    statusDiv.innerHTML = message;
}

function clearSettingsStatus() {
    const statusDiv = document.getElementById('settings-status');
    statusDiv.classList.add('hidden');
    statusDiv.innerHTML = '';
}

// Refresh UI components with new settings
async function refreshUIWithNewSettings() {
    // Refresh character counter
    if (typeof refreshCharacterCounter === 'function') {
        await refreshCharacterCounter();
    }

    // Refresh file upload text
    if (typeof updateFileUploadText === 'function') {
        await updateFileUploadText();
    }
}

// Update markdown CSS visibility
function updateMarkdownCSS(enabled) {
    const markdownCSS = document.getElementById('markdown-css');

    // Always update body class regardless of markdownCSS element existence
    if (enabled) {
        document.body.classList.remove('markdown-disabled');
        if (markdownCSS) {
            markdownCSS.removeAttribute('disabled');
        }
    } else {
        document.body.classList.add('markdown-disabled');
        if (markdownCSS) {
            markdownCSS.setAttribute('disabled', 'disabled');
        }
    }

    console.log('Markdown enabled:', enabled, 'Body has markdown-disabled class:', document.body.classList.contains('markdown-disabled'));
}

// Toggle file upload details visibility based on enabled state
function toggleFileUploadDetails() {
    const fileUploadEnabled = document.getElementById('fileUploadEnabled').checked;
    const detailsSection = document.getElementById('fileUploadDetails');

    if (fileUploadEnabled) {
        detailsSection.style.display = 'block';
    } else {
        detailsSection.style.display = 'none';
    }
}

// Update site description character counter
function updateSiteDescriptionCounter() {
    const descriptionField = document.getElementById('siteDescription');
    const counter = document.getElementById('site-description-counter');
    if (descriptionField && counter) {
        counter.textContent = descriptionField.value.length;
    }
}

// Update page title dynamically
function updatePageTitle(siteTitle) {
    const currentRoute = window.router?.getCurrentRoute();
    if (currentRoute === '/settings') {
        document.title = `${siteTitle} - Settings`;
    } else if (currentRoute === '/' || !currentRoute) {
        document.title = `${siteTitle} - Personal Micro Blog`;
    }
    // Category titles will be updated by the router
}

// Initialize settings when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeSettings();

    // Add file upload toggle listener
    const fileUploadCheckbox = document.getElementById('fileUploadEnabled');
    if (fileUploadCheckbox) {
        fileUploadCheckbox.addEventListener('change', toggleFileUploadDetails);
        // Initialize visibility on load
        setTimeout(() => toggleFileUploadDetails(), 100);
    }

    // Add site description counter listener
    const descriptionField = document.getElementById('siteDescription');
    if (descriptionField) {
        descriptionField.addEventListener('input', updateSiteDescriptionCounter);
    }
});