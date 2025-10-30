import { useState, useEffect } from 'preact/hooks';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertState {
  message: string;
  type: AlertType;
  isVisible: boolean;
  isHiding: boolean;
}

let showAlertCallback: ((message: string, type: AlertType) => void) | null = null;

// Global functions for easy access (similar to vanilla JS version)
export const showSuccess = (message: string) => showAlertCallback?.(message, 'success');
export const showError = (message: string) => showAlertCallback?.(message, 'error');
export const showWarning = (message: string) => showAlertCallback?.(message, 'warning');
export const showInfo = (message: string) => showAlertCallback?.(message, 'info');

export function DropdownAlert() {
  const [alert, setAlert] = useState<AlertState>({
    message: '',
    type: 'success',
    isVisible: false,
    isHiding: false,
  });
  const [timeoutId, setTimeoutId] = useState<number | null>(null);

  // Register the show alert callback
  useEffect(() => {
    showAlertCallback = (message: string, type: AlertType) => {
      // Clear existing timeout
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }

      // If already showing, hide first then show new message
      if (alert.isVisible) {
        setAlert(prev => ({ ...prev, isHiding: true }));
        setTimeout(() => {
          displayMessage(message, type);
        }, 100);
      } else {
        displayMessage(message, type);
      }
    };

    return () => {
      showAlertCallback = null;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [alert.isVisible, timeoutId]);

  const displayMessage = (message: string, type: AlertType) => {
    setAlert({
      message,
      type,
      isVisible: true,
      isHiding: false,
    });

    // Set auto-hide timeout
    const duration = type === 'success' ? 1500 : 3000;
    const id = setTimeout(() => {
      hideAlert();
    }, duration) as unknown as number;
    setTimeoutId(id);
  };

  const hideAlert = () => {
    setAlert(prev => ({ ...prev, isHiding: true }));
    setTimeout(() => {
      setAlert(prev => ({ ...prev, isVisible: false, isHiding: false }));
      setTimeoutId(null);
    }, 250);
  };

  if (!alert.isVisible) {
    return null;
  }

  const alertClasses = [
    'alert-dropdown',
    alert.type,
    alert.isVisible && !alert.isHiding ? 'show' : '',
    alert.isHiding ? 'hide' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="alert-container">
      <div className={alertClasses}>
        <span className="alert-text">{alert.message}</span>
      </div>
    </div>
  );
}
