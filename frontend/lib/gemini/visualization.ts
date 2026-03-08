import { GoogleGenAI } from "@google/genai";

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  return new GoogleGenAI({ apiKey });
};

export interface GenerateVisualizationInput {
  imageDescription: string;
  canvasImageData?: string;
}

export interface GenerateVisualizationResult {
  imageData: string;
}

interface GeminiInlineDataPart {
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiInlineDataPart[];
  };
}

interface GeminiPartsLikeResponse {
  parts?: GeminiInlineDataPart[];
  candidates?: GeminiCandidate[];
  response?: {
    parts?: GeminiInlineDataPart[];
  };
}

const extractParts = (response: unknown): GeminiInlineDataPart[] => {
  if (!response || typeof response !== 'object') {
    return [];
  }

  const candidate = response as GeminiPartsLikeResponse;
  if (Array.isArray(candidate.parts)) {
    return candidate.parts;
  }

  if (Array.isArray(candidate.candidates?.[0]?.content?.parts)) {
    return candidate.candidates[0].content.parts;
  }

  if (Array.isArray(candidate.response?.parts)) {
    return candidate.response.parts;
  }

  return [];
};

function extractBase64FromDataUrl(dataUrl: string): string {
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
}

export async function generateVisualization({
  imageDescription,
  canvasImageData,
}: GenerateVisualizationInput): Promise<GenerateVisualizationResult> {
  try {
    const ai = getGeminiClient();
    let contents:
      | string
      | Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;

    if (canvasImageData) {
      const base64Image = extractBase64FromDataUrl(canvasImageData);
      contents = [
        { text: imageDescription },
        {
          inlineData: {
            mimeType: "image/png",
            data: base64Image,
          },
        },
      ];
    } else {
      contents = imageDescription;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents,
    });

    const parts = extractParts(response);

    if (parts.length === 0) {
      throw new Error('No response data returned from API');
    }

    for (const part of parts) {
      if (part.inlineData?.data) {
        return {
          imageData: `data:image/png;base64,${part.inlineData.data}`,
        };
      }
    }

    throw new Error('No image data (inlineData) returned from API');
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to generate visualization: ${error.message}`
        : 'Failed to generate visualization'
    );
  }
}
