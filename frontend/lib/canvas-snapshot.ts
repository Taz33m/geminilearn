import type { Editor } from '@tldraw/tldraw';

/**
 * Capture canvas screenshot using Tldraw's toImage() method
 * Returns base64 data URL ready for Vision API
 */
export async function captureCanvasScreenshot(
  editor: Editor
): Promise<string> {
  try {
    // Get all shapes on current page
    const shapeIdsSet = editor.getCurrentPageShapeIds();

    if (shapeIdsSet.size === 0) {
      throw new Error('Canvas is empty');
    }

    // Convert Set to array (toImage expects an array)
    const shapeIds = Array.from(shapeIdsSet);

    // Export to PNG blob using Tldraw's toImage method
    const result = await editor.toImage(shapeIds, {
      format: 'png',
      background: true, // Include white background
      scale: 1, // Full resolution
    });

    const { blob } = result;

    // Convert blob to base64 data URL
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data);
      };
      reader.onerror = (error) => {
        console.error('[canvas] FileReader error:', error);
        reject(new Error('Failed to convert blob to base64'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[canvas] Failed to capture screenshot:', error);
    throw error instanceof Error
      ? error
      : new Error('Failed to capture canvas screenshot');
  }
}

