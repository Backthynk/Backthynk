import { signal } from '@preact/signals';

// Window size state
export const windowSize = signal({
  width: typeof window !== 'undefined' ? window.innerWidth : 0,
  height: typeof window !== 'undefined' ? window.innerHeight : 0,
});

// Initialize resize listener
if (typeof window !== 'undefined') {
  const handleResize = () => {
    windowSize.value = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  };

  window.addEventListener('resize', handleResize);
}
