import { GoogleGenAI } from "@google/genai";

import { flashcardSetSchema, FlashcardSet } from "@/types/flashcard";

const SYSTEM_PROMPT = `You are a senior instructional designer helping a teacher create study flashcards.
Always:
- Ground content in the provided lecture context when available.
- Keep language concise, clear, and classroom-friendly.
- Include accurate citations in "source" when lecture context references a module/slide/reading.
- Avoid inventing facts or sources beyond the supplied context.`;

const FLASHCARD_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    flashcards: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          coreIdea: { type: "string" },
          question: { type: "string" },
          answer: { type: "string" },
          source: { type: "string" },
        },
        required: ["id", "title", "coreIdea", "question", "answer"],
        additionalProperties: false,
      },
    },
  },
  required: ["flashcards"],
  additionalProperties: false,
};

export interface GenerateFlashcardsInput {
  topic: string;
  focus?: string;
  lectureContext?: string | null;
}

export interface GenerateFlashcardsResult {
  flashcards: FlashcardSet["flashcards"];
}

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return new GoogleGenAI({ apiKey });
};

export async function generateFlashcards({
  topic,
  focus,
  lectureContext,
}: GenerateFlashcardsInput): Promise<GenerateFlashcardsResult> {
  const contextualPromptParts = [
    `Topic: ${topic}`,
    focus ? `Focus: ${focus}` : null,
    lectureContext ? `Lecture context:\n${lectureContext}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Create 3-6 high quality study flashcards.\n\n${contextualPromptParts}`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: FLASHCARD_RESPONSE_JSON_SCHEMA,
        temperature: 0.7,
      },
    });

    const rawJson = response.text;
    if (!rawJson) {
      throw new Error("Model returned empty flashcard response");
    }

    const parsed = JSON.parse(rawJson);
    const validated = flashcardSetSchema.parse(parsed);

    return {
      flashcards: validated.flashcards,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to generate flashcards: ${error.message}`
        : "Failed to generate flashcards"
    );
  }
}
