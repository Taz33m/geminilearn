import { GoogleGenAI } from '@google/genai';

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  return new GoogleGenAI({ apiKey });
};

export interface GenerateDeepDiveInput {
  topic: string;
}

export interface GenerateDeepDiveResult {
  imageData: string;
  overviewText: string;
}

interface GeminiInlineDataPart {
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
  text?: string;
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

async function generateDeepDiveImage(topic: string): Promise<string> {
  try {
    const ai = getGeminiClient();
    const imagePrompt = `Generate an educational visualization image about: ${topic}. Make the illustration very detailed with easy to understand and interpret illustrations of the topic.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: imagePrompt,
    });

    const parts = extractParts(response);
    if (parts.length === 0) {
      throw new Error('No response data returned from API');
    }

    for (const part of parts) {
      if (part.inlineData?.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw new Error('No image data (inlineData) returned from API');
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to generate deep dive image: ${error.message}`
        : 'Failed to generate deep dive image'
    );
  }
}

async function generateDeepDiveText(topic: string): Promise<string> {
  try {
    const ai = getGeminiClient();
    const textPrompt = `Write a concise, well-formatted educational overview of: ${topic}. Maximum 100 words. Use proper paragraph breaks. Focus on key concepts and insights. Make it suitable for students. Do not exceed 100 words.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: textPrompt,
    });

    if (response.text) {
      return response.text.trim();
    }

    const parts = extractParts(response);
    const firstText = parts.find((part) => typeof part.text === 'string')?.text;

    if (!firstText) {
      throw new Error('No text returned from API');
    }

    return firstText.trim();
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to generate deep dive text: ${error.message}`
        : 'Failed to generate deep dive text'
    );
  }
}

export async function generateDeepDive({
  topic,
}: GenerateDeepDiveInput): Promise<GenerateDeepDiveResult> {
  try {
    const [imageData, overviewText] = await Promise.all([
      generateDeepDiveImage(topic),
      generateDeepDiveText(topic),
    ]);

    return {
      imageData,
      overviewText,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to generate deep dive: ${error.message}`
        : 'Failed to generate deep dive'
    );
  }
}
