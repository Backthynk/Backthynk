// Dropdown Alert System
class DropdownAlert {
    constructor() {
        this.timeout = null;
        this.isActive = false;
        this.container = null;
        this.initializeContainer();
    }

    initializeContainer() {
        this.container = document.createElement('div');
        this.container.className = 'alert-container';
        this.container.innerHTML = `
            <div class="alert-dropdown">
                <span class="alert-text"></span>
            </div>
        `;
        document.body.appendChild(this.container);
        this.addStyles();
    }

    addStyles() {
        // Styles moved to main.css for better minification
        // CSS classes: .alert-container, .alert-dropdown, .alert-text
    }

    show(message, type = 'success') {
        return new Promise((resolve) => {
            // Clear any existing timeout
            this.clearTimeout();

            // If already showing, hide first then show new message
            if (this.isActive) {
                this.hideImmediate().then(() => {
                    setTimeout(() => this.displayMessage(message, type, resolve), 50);
                });
            } else {
                this.displayMessage(message, type, resolve);
            }
        });
    }

    displayMessage(message, type, resolve) {
        const dropdown = this.container.querySelector('.alert-dropdown');
        const textElement = dropdown.querySelector('.alert-text');

        // Reset all classes and set initial state
        dropdown.className = 'alert-dropdown';
        dropdown.classList.add(type);
        textElement.textContent = message;

        // Mark as active
        this.isActive = true;

        // Force initial position (hidden)
        dropdown.offsetHeight; // Force reflow

        // Show with animation
        requestAnimationFrame(() => {
            dropdown.classList.add('show');

            // Set auto-hide timeout
            const duration = type === 'success' ? 2000 : 4000;
            this.timeout = setTimeout(() => {
                this.hide().then(resolve);
            }, duration);
        });
    }

    hide() {
        return new Promise((resolve) => {
            if (!this.isActive) {
                resolve();
                return;
            }

            const dropdown = this.container.querySelector('.alert-dropdown');

            // Add hide class for smooth exit animation
            dropdown.classList.remove('show');
            dropdown.classList.add('hide');

            // Wait for animation to complete
            setTimeout(() => {
                this.isActive = false;
                dropdown.classList.remove('hide');
                resolve();
            }, 250); // Match the hide transition duration
        });
    }

    hideImmediate() {
        return new Promise((resolve) => {
            if (!this.isActive) {
                resolve();
                return;
            }

            const dropdown = this.container.querySelector('.alert-dropdown');
            dropdown.classList.remove('show');
            dropdown.classList.add('hide');

            setTimeout(() => {
                this.isActive = false;
                dropdown.classList.remove('hide');
                resolve();
            }, 100); // Faster for immediate hide
        });
    }

    clearTimeout() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }
}

// Global alert instance
window.alertSystem = new DropdownAlert();

// Global functions for easy access
window.showSuccess = (message) => window.alertSystem.show(message, 'success');
window.showError = (message) => window.alertSystem.show(message, 'error');
window.showWarning = (message) => window.alertSystem.show(message, 'warning');
window.showInfo = (message) => window.alertSystem.show(message, 'info');