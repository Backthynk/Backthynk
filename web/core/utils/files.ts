// File utilities adapted from _oldweb

export function getFileIcon(fileExtension: string): string {
  const ext = fileExtension.toLowerCase();

  const iconMap: Record<string, { icon: string; extensions: string[] }> = {
    image: { icon: 'fa-file-image', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'] },
    video: { icon: 'fa-file-video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
    audio: { icon: 'fa-file-audio', extensions: ['mp3', 'wav', 'ogg', 'flac'] },
    pdf: { icon: 'fa-file-pdf', extensions: ['pdf'] },
    archive: { icon: 'fa-file-archive', extensions: ['zip', 'rar', '7z', 'tar', 'gz'] },
    code: { icon: 'fa-file-code', extensions: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'php', 'rb', 'go', 'rs', 'swift', 'kt'] },
    document: { icon: 'fa-file-alt', extensions: ['doc', 'docx', 'txt', 'rtf', 'odt'] },
    spreadsheet: { icon: 'fa-file-excel', extensions: ['xls', 'xlsx', 'csv'] },
    presentation: { icon: 'fa-file-powerpoint', extensions: ['ppt', 'pptx'] },
  };

  for (const category of Object.values(iconMap)) {
    if (category.extensions.includes(ext)) {
      return category.icon;
    }
  }

  return 'fa-file';
}

export function isImageFile(mimeType: string | undefined): boolean {
  return mimeType?.startsWith('image/') ?? false;
}

/**
 * Check if a file supports preview based on its filename extension and config.
 * If config is not provided, returns false for non-image files.
 */
export function supportsPreview(filename: string, supportedFormats?: string[]): boolean {
  if (!supportedFormats || supportedFormats.length === 0) {
    return false;
  }

  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return false;

  return supportedFormats.includes(ext);
}

/**
 * Check if a file should be rendered as an image (either native image or has preview support)
 */
export function canRenderAsImage(mimeType: string | undefined, filename: string, supportedFormats?: string[]): boolean {
  // Native images always render as images
  if (isImageFile(mimeType)) {
    return true;
  }

  // Check if preview is supported
  return supportsPreview(filename, supportedFormats);
}
