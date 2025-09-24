// Settings functionality
let currentSettings = {};
let originalSettings = {};

function initializeSettings() {
    // Add event listeners
    document.getElementById('settings-btn').addEventListener('click', showSettingsPage);
    document.getElementById('settings-back-btn').addEventListener('click', hideSettingsPage);
    document.getElementById('cancel-settings-btn').addEventListener('click', cancelSettings);
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
    document.getElementById('reset-settings-btn').addEventListener('click', resetToDefaults);
}

async function showSettingsPage() {
    // Use router to navigate to settings
    if (window.router) {
        window.router.navigate('/settings');
    } else {
        // Fallback if router not available
        try {
            await loadSettings();
            document.querySelector('.container').style.display = 'none';
            document.getElementById('settings-page').classList.remove('hidden');
            populateSettingsForm();
        } catch (error) {
            showError('Failed to load settings: ' + error.message);
        }
    }
}

function hideSettingsPage() {
    // Use router to navigate back to home
    if (window.router) {
        window.router.navigate('/');
    } else {
        // Fallback if router not available
        document.getElementById('settings-page').classList.add('hidden');
        document.querySelector('.container').style.display = 'block';
        clearSettingsStatus();
    }
}

async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        currentSettings = await response.json();
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
    document.getElementById('storagePath').value = currentSettings.storagePath || window.AppConstants.DEFAULT_SETTINGS.storagePath;
}

function getSettingsFromForm() {
    return {
        maxFileSizeMB: parseInt(document.getElementById('maxFileSizeMB').value),
        maxContentLength: parseInt(document.getElementById('maxContentLength').value),
        maxFilesPerPost: parseInt(document.getElementById('maxFilesPerPost').value)
    };
}

function validateSettings(settings) {
    const errors = [];

    if (settings.maxFileSizeMB < window.AppConstants.VALIDATION_LIMITS.minFileSizeMB || settings.maxFileSizeMB > window.AppConstants.VALIDATION_LIMITS.maxFileSizeMB) {
        errors.push(window.AppConstants.ERROR_MESSAGES.fileSizeValidation);
    }

    if (settings.maxContentLength < window.AppConstants.VALIDATION_LIMITS.minContentLength || settings.maxContentLength > window.AppConstants.VALIDATION_LIMITS.maxContentLength) {
        errors.push(window.AppConstants.ERROR_MESSAGES.contentLengthValidation);
    }

    if (settings.maxFilesPerPost < window.AppConstants.VALIDATION_LIMITS.minFilesPerPost || settings.maxFilesPerPost > window.AppConstants.VALIDATION_LIMITS.maxFilesPerPost) {
        errors.push(window.AppConstants.ERROR_MESSAGES.filesPerPostValidation);
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
        showSettingsStatus('Saving settings...', 'info');

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

        showSettingsStatus('Settings saved successfully!', 'success');

        setTimeout(() => {
            if (window.router) {
                window.router.navigate('/');
            } else {
                hideSettingsPage();
            }
        }, window.AppConstants.UI_CONFIG.successMessageDelay);

    } catch (error) {
        console.error('Error saving settings:', error);
        showSettingsStatus('Failed to save settings: ' + error.message, 'error');
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
    if (confirm('Are you sure you want to reset all settings to their default values?')) {
        document.getElementById('maxFileSizeMB').value = window.AppConstants.DEFAULT_SETTINGS.maxFileSizeMB;
        document.getElementById('maxContentLength').value = window.AppConstants.DEFAULT_SETTINGS.maxContentLength;
        document.getElementById('maxFilesPerPost').value = window.AppConstants.DEFAULT_SETTINGS.maxFilesPerPost;
        // Storage path is not reset as it's read-only
        showSettingsStatus('Settings reset to defaults (not saved yet). Storage path is not changed as it requires server restart.', 'info');
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