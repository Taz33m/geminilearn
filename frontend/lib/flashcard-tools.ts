import { FunctionDeclaration } from "@google/genai";

import type {
  Flashcard,
  FlashcardSessionState,
  FlashcardActions,
} from "@/types/flashcard";
import { playToolCue } from "@/lib/audio";

export type GeminiToolHandler = (
  args: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

export interface FlashcardToolContext {
  actions: FlashcardActions;
  getFlashcardSession: () => FlashcardSessionState;
  setContentView: (view: 'flashcards' | 'visualization' | 'deepdive') => void;
}

export const FLASHCARD_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "generate_flashcards",
    description: "Generate a deck of study flashcards for a requested topic.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          minLength: 2,
          description: "Topic for the flashcard deck.",
        },
        focus: {
          type: "string",
          minLength: 2,
          description: "Optional focus area for the deck.",
        },
      },
      required: ["topic"],
      additionalProperties: false,
    },
  },
  {
    name: "get_current_flashcard_context",
    description:
      "Get information about the current flashcard being reviewed.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "flip_flashcard",
    description:
      "Flip the current flashcard to show or hide the answer side.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "next_flashcard",
    description: "Move to the next flashcard.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "previous_flashcard",
    description: "Move to the previous flashcard.",
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

export const createFlashcardToolHandlers = ({
  actions,
  getFlashcardSession,
  setContentView,
}: FlashcardToolContext): Record<string, GeminiToolHandler> => ({
  generate_flashcards: async (args) => {
    const topic = getStringArg(args, "topic");
    const focus = getStringArg(args, "focus");

    if (!topic) {
      const result = {
        success: false,
        message: "Topic is required to generate flashcards.",
      };
      playToolCue(result);
      return result;
    }

    try {
      setContentView("flashcards");
      actions.setMode("generating");

      const response = await fetch("/api/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, focus }),
      });

      const payload = await response.json();

      if (!response.ok || payload.success === false) {
        throw new Error(payload.error ?? "Unable to generate flashcards");
      }

      const flashcards = payload.flashcards as Flashcard[];
      actions.setCards(flashcards);
      actions.setMode("reviewing");

      const result = {
        success: true,
        count: flashcards.length,
        message: `Generated ${flashcards.length} flashcards on ${topic}.`,
      };
      playToolCue(result);
      return result;
    } catch (error) {
      actions.setMode("idle");
      const reason =
        error instanceof Error ? error.message : "Unknown generation error";
      const result = {
        success: false,
        message: `I couldn't generate flashcards: ${reason}`,
      };
      playToolCue(result);
      return result;
    }
  },

  get_current_flashcard_context: async () => {
    const flashcardSession = getFlashcardSession();

    if (flashcardSession.cards.length === 0) {
      return {
        success: false,
        available: false,
        message: "No flashcards are currently loaded.",
      };
    }

    const currentCard = flashcardSession.cards[flashcardSession.currentIndex];
    const position = `${flashcardSession.currentIndex + 1} of ${flashcardSession.cards.length}`;

    return {
      success: true,
      available: true,
      title: currentCard.title,
      question: currentCard.question,
      coreIdea: currentCard.coreIdea,
      isFlipped: flashcardSession.isFlipped,
      answer: flashcardSession.isFlipped
        ? currentCard.answer
        : "[hidden - do not reveal]",
      position,
      source: currentCard.source ?? null,
      message: `Current flashcard: "${currentCard.title}" (${position}). ${flashcardSession.isFlipped ? "Answer is revealed." : "Showing question side."}`,
    };
  },

  flip_flashcard: async () => {
    try {
      actions.flipCard();
      const result = {
        success: true,
        message: "Card flipped.",
      };
      playToolCue(result);
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      const result = {
        success: false,
        message: `Could not flip card: ${reason}`,
      };
      playToolCue(result);
      return result;
    }
  },

  next_flashcard: async () => {
    try {
      actions.nextCard();
      const result = {
        success: true,
        message: "Moved to next card.",
      };
      playToolCue(result);
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      const result = {
        success: false,
        message: `Could not move to next card: ${reason}`,
      };
      playToolCue(result);
      return result;
    }
  },

  previous_flashcard: async () => {
    try {
      actions.previousCard();
      const result = {
        success: true,
        message: "Moved to previous card.",
      };
      playToolCue(result);
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      const result = {
        success: false,
        message: `Could not move to previous card: ${reason}`,
      };
      playToolCue(result);
      return result;
    }
  },
});
