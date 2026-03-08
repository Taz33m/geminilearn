import { GoogleGenAI } from "@google/genai";

export interface GoogleDocSection {
  heading: string;
  content: string;
  bullets: string[];
}

export interface GenerateGoogleDocInput {
  topic: string;
  purpose?: string;
  audience?: string;
}

export interface GenerateGoogleDocResult {
  title: string;
  summary: string;
  sections: GoogleDocSection[];
}

const DOC_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    sections: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          content: { type: "string" },
          bullets: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["heading", "content", "bullets"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "summary", "sections"],
  additionalProperties: false,
} as const;

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return new GoogleGenAI({ apiKey });
};

export async function generateGoogleDoc({
  topic,
  purpose,
  audience,
}: GenerateGoogleDocInput): Promise<GenerateGoogleDocResult> {
  const ai = getGeminiClient();

  const prompt = [
    "Create an educational memo-style Google Doc draft in JSON.",
    `Topic: ${topic}`,
    purpose ? `Purpose: ${purpose}` : null,
    audience ? `Audience: ${audience}` : null,
    "Keep language concise, accurate, and student-friendly.",
    "Return 2-6 sections with practical explanation bullets.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: DOC_RESPONSE_SCHEMA,
      temperature: 0.4,
    },
  });

  if (!response.text) {
    throw new Error("Model returned empty Google Doc response");
  }

  const parsed = JSON.parse(response.text) as GenerateGoogleDocResult;

  return {
    title: parsed.title,
    summary: parsed.summary,
    sections: parsed.sections.map((section) => ({
      heading: section.heading,
      content: section.content,
      bullets: Array.isArray(section.bullets) ? section.bullets : [],
    })),
  };
}
