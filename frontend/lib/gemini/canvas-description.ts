import { GoogleGenAI } from '@google/genai';

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  return new GoogleGenAI({ apiKey });
};

const SYSTEM_PROMPT_BASE = `You are analyzing a whiteboard canvas used for teaching and learning. 
Describe what's drawn on it in detail, including:
- Shapes, lines, and drawings
- Text labels and annotations
- Layout and organization
- Relationships between elements
- Colors used
- Overall structure and purpose

Be concise but comprehensive. Focus on what would be useful for a teaching assistant to understand.`;

/**
 * Extract base64 string from data URL
 */
function extractBase64FromDataUrl(dataUrl: string): string {
  // Remove data URL prefix (e.g., "data:image/png;base64,")
  return dataUrl.includes(',') 
    ? dataUrl.split(',')[1] 
    : dataUrl;
}

/**
 * Describe canvas content using Gemini Flash Lite Vision API
 * @param imageDataUrl - Base64 data URL of canvas screenshot
 * @param conversationContext - Optional context about what's been discussed
 * @returns Description of canvas content
 */
export async function describeCanvas(
  imageDataUrl: string,
  conversationContext?: string
): Promise<string> {
  // Extract base64 from data URL
  const base64Image = extractBase64FromDataUrl(imageDataUrl);

  // Build prompt with optional context
  let promptText: string;
  if (conversationContext) {
    promptText = `${SYSTEM_PROMPT_BASE}

CONVERSATION CONTEXT:
The user and teaching assistant have been discussing: ${conversationContext}

Use this context to better understand what's drawn on the canvas. If the conversation mentions specific topics (e.g., "photosynthesis", "mitosis"), use that knowledge to identify and describe related elements in the drawing. The context should guide your interpretation, but still describe what you actually see.

Describe everything visible on this canvas in detail. The conversation context above may help you understand what's being drawn. What shapes, text, and elements are present? How are they arranged? What is the overall purpose or topic?`;
  } else {
    promptText = `${SYSTEM_PROMPT_BASE}

Describe everything visible on this canvas in detail. What shapes, text, and elements are present? How are they arranged? What is the overall purpose or topic?`;
  }

  try {
    const ai = getGeminiClient();
    // Build contents array following Gemini format
    const contents = [
      {
        inlineData: {
          mimeType: 'image/png',
          data: base64Image,
        },
      },
      { text: promptText },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: contents,
    });

    // Access response.text (Gemini format)
    return response.text || 'Unable to describe canvas';
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to describe canvas: ${error.message}`
        : 'Failed to describe canvas'
    );
  }
}
