import { FunctionDeclaration } from "@google/genai";

import { playToolCue } from "@/lib/audio";
import { GeminiToolHandler } from "@/lib/flashcard-tools";
import type { GoogleDocSection, GoogleSheetTab } from "@/types/session";

export interface ArtifactToolContext {
  onSetGoogleDoc?: (title: string, summary: string, sections: GoogleDocSection[]) => void;
  onSetGoogleSheet?: (title: string, summary: string, sheets: GoogleSheetTab[]) => void;
}

const getStringArg = (args: Record<string, unknown>, key: string) => {
  const value = args[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const ARTIFACT_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "create_google_doc",
    description:
      "Create a Google Docs-style memo or notes artifact for the current topic.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          minLength: 2,
          description: "Topic to turn into a memo-style document.",
        },
        purpose: {
          type: "string",
          minLength: 2,
          description: "Optional purpose of the memo.",
        },
        audience: {
          type: "string",
          minLength: 2,
          description: "Optional target audience.",
        },
      },
      required: ["topic"],
      additionalProperties: false,
    },
  },
  {
    name: "create_google_sheet",
    description:
      "Create a Google Sheets-style spreadsheet artifact for structured data.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          minLength: 2,
          description: "Topic to convert into spreadsheet data.",
        },
        objective: {
          type: "string",
          minLength: 2,
          description: "Optional objective for the sheet data.",
        },
      },
      required: ["topic"],
      additionalProperties: false,
    },
  },
];

export const createArtifactToolHandlers = ({
  onSetGoogleDoc,
  onSetGoogleSheet,
}: ArtifactToolContext): Record<string, GeminiToolHandler> => ({
  create_google_doc: async (args) => {
    const topic = getStringArg(args, "topic");
    const purpose = getStringArg(args, "purpose");
    const audience = getStringArg(args, "audience");

    if (!topic) {
      const result = {
        success: false,
        message: "Topic is required to create a Google Doc artifact.",
      };
      playToolCue(result);
      return result;
    }

    try {
      const response = await fetch("/api/generate-google-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, purpose, audience }),
      });

      const payload = await response.json();
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error ?? "Unable to create Google Doc artifact");
      }

      const sections = payload.sections as GoogleDocSection[];
      onSetGoogleDoc?.(payload.title as string, payload.summary as string, sections);

      const result = {
        success: true,
        message: `Created Google Doc artifact: ${payload.title}.`,
      };
      playToolCue(result);
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      const result = {
        success: false,
        message: `I couldn't create the Google Doc artifact: ${reason}`,
      };
      playToolCue(result);
      return result;
    }
  },

  create_google_sheet: async (args) => {
    const topic = getStringArg(args, "topic");
    const objective = getStringArg(args, "objective");

    if (!topic) {
      const result = {
        success: false,
        message: "Topic is required to create a Google Sheet artifact.",
      };
      playToolCue(result);
      return result;
    }

    try {
      const response = await fetch("/api/generate-google-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, objective }),
      });

      const payload = await response.json();
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error ?? "Unable to create Google Sheet artifact");
      }

      const sheets = payload.sheets as GoogleSheetTab[];
      onSetGoogleSheet?.(payload.title as string, payload.summary as string, sheets);

      const result = {
        success: true,
        message: `Created Google Sheets artifact: ${payload.title}.`,
      };
      playToolCue(result);
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      const result = {
        success: false,
        message: `I couldn't create the Google Sheets artifact: ${reason}`,
      };
      playToolCue(result);
      return result;
    }
  },
});
