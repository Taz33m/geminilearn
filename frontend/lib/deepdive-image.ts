'use client';

/**
 * Generate an image from text using Canvas API
 * @param text - The text to render
 * @param options - Styling options
 * @returns Promise resolving to base64 data URL of the text image
 */
export async function generateTextImage(
  text: string,
  options: {
    width?: number;
    fontSize?: number;
    lineHeight?: number;
    padding?: number;
    fontFamily?: string;
    textColor?: string;
    backgroundColor?: string;
  } = {}
): Promise<string> {
  const {
    width = 600,
    fontSize = 16,
    lineHeight = 1.6,
    padding = 24,
    fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    textColor = '#374151', // zinc-700
    backgroundColor = '#f9fafb', // zinc-50
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Create a temporary canvas to measure text
      const measureCanvas = document.createElement('canvas');
      const measureCtx = measureCanvas.getContext('2d');
      if (!measureCtx) {
        reject(new Error('Could not create canvas context'));
        return;
      }

      measureCtx.font = `${fontSize}px ${fontFamily}`;
      const maxWidth = width - padding * 2;
      const lineHeightPx = fontSize * lineHeight;

      // Split text into paragraphs (double newlines)
      const paragraphs = text.split(/\n\n+/);
      const lines: string[] = [];

      // Process each paragraph
      paragraphs.forEach((paragraph, paraIndex) => {
        // Split paragraph into words
        const words = paragraph.trim().split(/\s+/);
        let currentLine = '';

        words.forEach((word) => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = measureCtx.measureText(testLine);

          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });

        if (currentLine) {
          lines.push(currentLine);
        }

        // Add empty line between paragraphs (except after last)
        if (paraIndex < paragraphs.length - 1) {
          lines.push('');
        }
      });

      // Calculate canvas height
      const textHeight = lines.length * lineHeightPx;
      const canvasHeight = textHeight + padding * 2;

      // Create final canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not create canvas context'));
        return;
      }

      // Fill background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, canvasHeight);

      // Set text style
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.fillStyle = textColor;
      ctx.textBaseline = 'top';

      // Draw text lines
      lines.forEach((line, index) => {
        const y = padding + index * lineHeightPx;
        ctx.fillText(line, padding, y);
      });

      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Failed to generate text image'));
    }
  });
}

/**
 * Combine two images vertically (image1 on top, image2 below)
 * @param image1DataUrl - Base64 data URL of the top image
 * @param image2DataUrl - Base64 data URL of the bottom image
 * @param spacing - Spacing between images in pixels
 * @returns Promise resolving to base64 data URL of the combined image
 */
export async function combineImagesVertically(
  image1DataUrl: string,
  image2DataUrl: string,
  spacing: number = 16
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const img1 = new Image();
      const img2 = new Image();

      let imagesLoaded = 0;
      const checkComplete = () => {
        imagesLoaded++;
        if (imagesLoaded === 2) {
          try {
            // Calculate combined dimensions
            const maxWidth = Math.max(img1.width, img2.width);
            const combinedHeight = img1.height + img2.height + spacing;

            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = maxWidth;
            canvas.height = combinedHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              reject(new Error('Could not create canvas context'));
              return;
            }

            // Fill white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, maxWidth, combinedHeight);

            // Draw first image (centered horizontally if narrower)
            const img1X = (maxWidth - img1.width) / 2;
            ctx.drawImage(img1, img1X, 0);

            // Draw second image below (centered horizontally if narrower)
            const img2X = (maxWidth - img2.width) / 2;
            const img2Y = img1.height + spacing;
            ctx.drawImage(img2, img2X, img2Y);

            // Convert to data URL
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
          } catch (error) {
            reject(error instanceof Error ? error : new Error('Failed to combine images'));
          }
        }
      };

      img1.onload = checkComplete;
      img2.onload = checkComplete;
      img1.onerror = () => reject(new Error('Failed to load first image'));
      img2.onerror = () => reject(new Error('Failed to load second image'));

      img1.src = image1DataUrl;
      img2.src = image2DataUrl;
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Failed to combine images'));
    }
  });
}

/**
 * Generate a combined deep dive image (original image + text as image)
 * @param originalImageDataUrl - Base64 data URL of the original image
 * @param text - The overview text to render
 * @returns Promise resolving to base64 data URL of the combined image
 */
export async function generateCombinedDeepDiveImage(
  originalImageDataUrl: string,
  text: string
): Promise<string> {
  try {
    // Generate text image
    const textImageDataUrl = await generateTextImage(text, {
      width: 600,
      fontSize: 16,
      lineHeight: 1.6,
      padding: 24,
    });

    // Combine images
    const combinedImageDataUrl = await combineImagesVertically(
      originalImageDataUrl,
      textImageDataUrl,
      16
    );

    return combinedImageDataUrl;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to generate combined image: ${error.message}`
        : 'Failed to generate combined image'
    );
  }
}

