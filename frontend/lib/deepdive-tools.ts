import { FunctionDeclaration } from "@google/genai";

import { playToolCue } from "@/lib/audio";
import type { DeepDiveActions } from "@/types/deepdive";
import { GeminiToolHandler } from "@/lib/flashcard-tools";

export interface DeepDiveToolContext {
  actions: DeepDiveActions;
  setContentView: (view: 'flashcards' | 'visualization' | 'deepdive') => void;
}

export const DEEP_DIVE_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "generate_deep_dive",
    description:
      "Generate a comprehensive deep dive on a topic, including an image and concise overview text.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          minLength: 2,
          description:
            "Topic for the deep dive, including relevant conversational or canvas context.",
        },
      },
      required: ["topic"],
      additionalProperties: false,
    },
  },
];

const getStringArg = (args: Record<string, unknown>, key: string) => {
  const value = args[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const createDeepDiveToolHandlers = ({
  actions,
  setContentView,
}: DeepDiveToolContext): Record<string, GeminiToolHandler> => ({
  generate_deep_dive: async (args) => {
    const topic = getStringArg(args, "topic");

    if (!topic) {
      const result = {
        success: false,
        message: "Topic is required for deep dive generation.",
      };
      playToolCue(result);
      return result;
    }

    try {
      setContentView("deepdive");
      actions.setMode("generating");

      const response = await fetch("/api/generate-deep-dive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });

      const payload = await response.json();

      if (!response.ok || payload.success === false) {
        throw new Error(payload.error ?? "Unable to generate deep dive");
      }

      const { imageData, overviewText } = payload as {
        imageData: string;
        overviewText: string;
      };

      actions.setDeepDive(imageData, overviewText, topic);
      actions.setMode("ready");

      const result = {
        success: true,
        message: `I've generated a deep dive on ${topic}. The visualization and overview are ready. Click the \"Copy to Clipboard\" button to copy the combined image, then paste it on the canvas with Cmd+V (Mac) or Ctrl+V (Windows).`,
      };
      playToolCue(result);
      return result;
    } catch (error) {
      actions.setMode("idle");
      const reason =
        error instanceof Error ? error.message : "Unknown deep dive generation error";
      const result = {
        success: false,
        message: `I couldn't generate the deep dive: ${reason}`,
      };
      playToolCue(result);
      return result;
    }
  },
});
