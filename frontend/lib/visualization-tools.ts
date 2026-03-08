import { FunctionDeclaration } from "@google/genai";
import type { Editor } from "@tldraw/tldraw";

import { captureCanvasScreenshot } from "@/lib/canvas-snapshot";
import { playToolCue } from "@/lib/audio";
import type { VisualizationActions } from "@/types/visualization";
import { GeminiToolHandler } from "@/lib/flashcard-tools";

export interface VisualizationToolContext {
  getCanvasEditor: () => Editor | null;
  actions: VisualizationActions;
  setContentView: (view: 'flashcards' | 'visualization' | 'deepdive') => void;
}

const VISUALIZATION_PARAMETERS_SCHEMA = {
  type: "object",
  properties: {
    imageDescription: {
      type: "string",
      minLength: 2,
      description:
        "Detailed image or diagram request. Include topic, style, and any labels when possible.",
    },
    prompt: {
      type: "string",
      minLength: 2,
      description:
        "Alternate prompt field. Use this when the user asks for a diagram or visual.",
    },
    topic: {
      type: "string",
      minLength: 2,
      description:
        "Short topic name for the requested diagram (for example: photosynthesis cycle).",
    },
    includeCanvasImage: {
      type: "boolean",
      description:
        "When true, capture current canvas and use it as additional input.",
    },
  },
  additionalProperties: false,
} as const;

export const VISUALIZATION_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "generate_visualization",
    description:
      "Generate an educational visualization image or diagram for the student. Use for diagram/chart/flow visual requests.",
    parametersJsonSchema: VISUALIZATION_PARAMETERS_SCHEMA,
  },
  {
    name: "generate_diagram",
    description:
      "Generate an educational diagram when the user asks to make, draw, or create a diagram.",
    parametersJsonSchema: VISUALIZATION_PARAMETERS_SCHEMA,
  },
  {
    name: "show_flashcards",
    description: "Switch the sidebar view back to flashcards.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
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

const getBooleanArg = (
  args: Record<string, unknown>,
  key: string,
  defaultValue: boolean,
) => {
  const value = args[key];
  return typeof value === "boolean" ? value : defaultValue;
};

const resolveVisualizationDescription = (args: Record<string, unknown>) => {
  const raw =
    getStringArg(args, "imageDescription") ??
    getStringArg(args, "prompt") ??
    getStringArg(args, "topic");

  if (!raw) {
    return undefined;
  }

  if (raw.length >= 18) {
    return raw;
  }

  return `Create a clear educational diagram about ${raw} with labeled parts, directional arrows, and concise annotations.`;
};

export const createVisualizationToolHandlers = ({
  getCanvasEditor,
  actions,
  setContentView,
}: VisualizationToolContext): Record<string, GeminiToolHandler> => {
  const runVisualizationGeneration: GeminiToolHandler = async (args) => {
    const imageDescription = resolveVisualizationDescription(args);
    const includeCanvasImage = getBooleanArg(
      args,
      "includeCanvasImage",
      false,
    );

    if (!imageDescription) {
      const result = {
        success: false,
        message: "Please provide a topic or description for the diagram.",
      };
      playToolCue(result);
      return result;
    }

    try {
      actions.setMode("generating");
      setContentView("visualization");

      let canvasImageData: string | undefined;
      if (includeCanvasImage) {
        const editor = getCanvasEditor();
        if (!editor) {
          throw new Error("Canvas is not available. Please ensure it is loaded.");
        }

        try {
          canvasImageData = await captureCanvasScreenshot(editor);
        } catch {
          // Continue without canvas if capture fails.
          canvasImageData = undefined;
        }
      }

      const requestBody: {
        imageDescription: string;
        canvasImageData?: string;
      } = { imageDescription };

      if (canvasImageData) {
        requestBody.canvasImageData = canvasImageData;
      }

      const response = await fetch("/api/generate-visualization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json();

      if (!response.ok || payload.success === false) {
        throw new Error(payload.error ?? "Unable to generate visualization");
      }

      const imageData = payload.imageData as string;
      actions.setVisualization(imageData, imageDescription);
      actions.setMode("ready");

      const result = {
        success: true,
        message: `I've ${canvasImageData ? "enhanced" : "generated"} a visualization for you. Click the \"Copy to Clipboard\" button to copy it, then paste it on the canvas with Cmd+V (Mac) or Ctrl+V (Windows).`,
      };
      playToolCue(result);
      return result;
    } catch (error) {
      actions.setMode("idle");
      const reason =
        error instanceof Error ? error.message : "Unknown visualization generation error";
      const result = {
        success: false,
        message: `I couldn't generate the visualization: ${reason}`,
      };
      playToolCue(result);
      return result;
    }
  };

  return {
    generate_visualization: runVisualizationGeneration,
    generate_diagram: runVisualizationGeneration,

    show_flashcards: async () => {
      try {
        setContentView("flashcards");
        const result = {
          success: true,
          message: "Switched back to flashcards view.",
        };
        playToolCue(result);
        return result;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown error";
        const result = {
          success: false,
          message: `Could not switch to flashcards: ${reason}`,
        };
        playToolCue(result);
        return result;
      }
    },
  };
};
