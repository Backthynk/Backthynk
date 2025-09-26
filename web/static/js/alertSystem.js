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
        if (document.getElementById('alert-styles')) return;

        const style = document.createElement('style');
        style.id = 'alert-styles';
        style.textContent = `
            .alert-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                z-index: 9999;
                pointer-events: none;
            }

            .alert-dropdown {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                padding: 8px 16px;
                transform: translateY(-100%);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                opacity: 1;
                visibility: visible;
            }

            .alert-dropdown.success {
                background-color: #75C590;
                min-height: 16px;
            }

            .alert-dropdown.error {
                background-color: #E06E6B;
                min-height: 32px;
            }

            .alert-dropdown.warning {
                background-color: #EFB840;
                min-height: 32px;
            }

            .alert-dropdown.info {
                background-color: #74ACFF;
                min-height: 32px;
            }

            .alert-dropdown.show {
                transform: translateY(0);
            }

            .alert-dropdown.hide {
                transform: translateY(-100%);
                transition: transform 0.25s cubic-bezier(0.55, 0.055, 0.675, 0.19);
            }

            .alert-text {
                color: white;
                font-size: 13px;
                font-weight: 500;
                text-align: center;
                line-height: 1.2;
            }
        `;
        document.head.appendChild(style);
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