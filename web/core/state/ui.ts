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

// ImageViewer state
export interface ImageViewerData {
  url: string;
  filename: string;
}

export const imageViewerState = signal<{
  isOpen: boolean;
  images: ImageViewerData[];
  startIndex: number;
}>({
  isOpen: false,
  images: [],
  startIndex: 0,
});

export const openImageViewer = (images: ImageViewerData[], startIndex: number = 0) => {
  imageViewerState.value = {
    isOpen: true,
    images,
    startIndex,
  };
};

export const closeImageViewer = () => {
  imageViewerState.value = {
    isOpen: false,
    images: [],
    startIndex: 0,
  };
};
