import type { PostFile } from '@core/api';
import { isImageFile, getFileIcon } from './files';
import { formatFileSize } from './format';

/**
 * File helper utilities for ImageGallery component
 */

export interface FileInfo {
  fileName: string;
  fileSize: string;
  fileExtension: string;
  isImage: boolean;
}

/**
 * Check if a file is an actual image (based on MIME type)
 */
export function checkIsImage(file: PostFile | File): boolean {
  if ('file_type' in file) {
    return isImageFile(file.file_type);
  }
  return file.type.startsWith('image/');
}

/**
 * Get file extension from filename
 */
export function getFileExtension(file: PostFile | File): string {
  const name = 'filename' in file ? file.filename : file.name;
  return name.split('.').pop()?.toLowerCase() || 'FILE';
}

/**
 * Get formatted file size
 */
export function getFileSize(file: PostFile | File): string {
  const size = 'file_size' in file ? file.file_size : file.size;
  return formatFileSize(size);
}

/**
 * Get file name
 */
export function getFileName(file: PostFile | File): string {
  return 'filename' in file ? file.filename : file.name;
}

/**
 * Get comprehensive file info
 */
export function getFileInfo(file: PostFile | File): FileInfo {
  return {
    fileName: getFileName(file),
    fileSize: getFileSize(file),
    fileExtension: getFileExtension(file),
    isImage: checkIsImage(file),
  };
}

/**
 * Get icon class for file type
 */
export function getFileIconClass(file: PostFile | File): string {
  const extension = getFileExtension(file);
  return getFileIcon(extension);
}
