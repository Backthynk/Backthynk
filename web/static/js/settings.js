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
    document.getElementById('maxFileSizeMB').value = currentSettings.maxFileSizeMB || window.AppConstants.DEFAULT_SETTINGS.maxFileSizeMB;
    document.getElementById('maxContentLength').value = currentSettings.maxContentLength || window.AppConstants.DEFAULT_SETTINGS.maxContentLength;
    document.getElementById('maxFilesPerPost').value = currentSettings.maxFilesPerPost || window.AppConstants.DEFAULT_SETTINGS.maxFilesPerPost;
    document.getElementById('activityEnabled').checked = currentSettings.activityEnabled !== undefined ? currentSettings.activityEnabled : window.AppConstants.DEFAULT_SETTINGS.activityEnabled;
    document.getElementById('fileStatsEnabled').checked = currentSettings.fileStatsEnabled !== undefined ? currentSettings.fileStatsEnabled : window.AppConstants.DEFAULT_SETTINGS.fileStatsEnabled;
    document.getElementById('retroactivePostingEnabled').checked = currentSettings.retroactivePostingEnabled !== undefined ? currentSettings.retroactivePostingEnabled : false;
}

function getSettingsFromForm() {
    return {
        maxFileSizeMB: parseInt(document.getElementById('maxFileSizeMB').value),
        maxContentLength: parseInt(document.getElementById('maxContentLength').value),
        maxFilesPerPost: parseInt(document.getElementById('maxFilesPerPost').value),
        activityEnabled: document.getElementById('activityEnabled').checked,
        fileStatsEnabled: document.getElementById('fileStatsEnabled').checked,
        retroactivePostingEnabled: document.getElementById('retroactivePostingEnabled').checked
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

// Initialize settings when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeSettings();
});