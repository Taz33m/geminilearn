import { GoogleGenAI } from "@google/genai";

export interface GoogleSheetTab {
  name: string;
  columns: string[];
  rows: string[][];
}

export interface GenerateGoogleSheetInput {
  topic: string;
  objective?: string;
}

export interface GenerateGoogleSheetResult {
  title: string;
  summary: string;
  sheets: GoogleSheetTab[];
}

const SHEET_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    sheets: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          columns: {
            type: "array",
            minItems: 2,
            maxItems: 8,
            items: { type: "string" },
          },
          rows: {
            type: "array",
            minItems: 3,
            maxItems: 12,
            items: {
              type: "array",
              minItems: 2,
              maxItems: 8,
              items: { type: "string" },
            },
          },
        },
        required: ["name", "columns", "rows"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "summary", "sheets"],
  additionalProperties: false,
} as const;

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return new GoogleGenAI({ apiKey });
};

const normalizeRows = (rows: string[][], columnCount: number) =>
  rows.map((row) => {
    const next = [...row.slice(0, columnCount)];
    while (next.length < columnCount) {
      next.push("");
    }
    return next;
  });

export async function generateGoogleSheet({
  topic,
  objective,
}: GenerateGoogleSheetInput): Promise<GenerateGoogleSheetResult> {
  const ai = getGeminiClient();

  const prompt = [
    "Create a spreadsheet-like data table in JSON for learning and analysis.",
    `Topic: ${topic}`,
    objective ? `Objective: ${objective}` : null,
    "Use realistic educational values and clear column names.",
    "Return between 3 and 12 rows per sheet.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: SHEET_RESPONSE_SCHEMA,
      temperature: 0.35,
    },
  });

  if (!response.text) {
    throw new Error("Model returned empty Google Sheets response");
  }

  const parsed = JSON.parse(response.text) as GenerateGoogleSheetResult;

  return {
    title: parsed.title,
    summary: parsed.summary,
    sheets: parsed.sheets.map((sheet) => {
      const columns = Array.isArray(sheet.columns) && sheet.columns.length > 1
        ? sheet.columns
        : ["Column A", "Column B"];

      return {
        name: sheet.name,
        columns,
        rows: normalizeRows(
          Array.isArray(sheet.rows) ? sheet.rows : [],
          columns.length,
        ),
      };
    }),
  };
}
