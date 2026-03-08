'use client';

/**
 * Convert base64 data URL to Blob synchronously
 */
function dataURLToBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Copy an image (base64 data URL) to the clipboard
 * @param imageDataUrl - Base64 data URL (e.g., "data:image/png;base64,...")
 * @returns Promise that resolves when image is copied
 */
export async function copyImageToClipboard(
  imageDataUrl: string
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Clipboard API is not available (server-side)');
  }

  if (!navigator.clipboard) {
    throw new Error('Clipboard API is not supported in this browser');
  }

  // Check if we're in a secure context
  if (!window.isSecureContext) {
    throw new Error('Clipboard API requires a secure context (HTTPS or localhost)');
  }

  try {
    // Convert data URL to Blob synchronously (no async operations that break user gesture)
    const blob = dataURLToBlob(imageDataUrl);
    const mimeType = blob.type || 'image/png';

    // Create ClipboardItem with image blob
    const clipboardItem = new ClipboardItem({
      [mimeType]: blob,
    });

    // Write to clipboard - must be called directly from user gesture handler
    await navigator.clipboard.write([clipboardItem]);

    console.log('[clipboard] Image copied to clipboard successfully', {
      mimeType,
      size: blob.size,
    });
  } catch (error) {
    console.error('[clipboard] Failed to copy image to clipboard:', error);
    
    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Clipboard access denied. Please ensure you clicked the button directly and the page is served over HTTPS or localhost.');
      }
      throw error;
    }
    
    throw new Error('Failed to copy image to clipboard');
  }
}

