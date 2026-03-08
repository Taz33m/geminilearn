import { z } from "zod";

export const flashcardSchema = z.object({
  id: z.string(),
  title: z.string(),
  coreIdea: z.string(),
  question: z.string(),
  answer: z.string(),
  source: z.string().optional(),
});

export const flashcardSetSchema = z.object({
  flashcards: flashcardSchema.array().min(3).max(8),
});

export type Flashcard = z.infer<typeof flashcardSchema>;
export type FlashcardSet = z.infer<typeof flashcardSetSchema>;

export interface FlashcardSessionState {
  cards: Flashcard[];
  currentIndex: number;
  isFlipped: boolean;
  mode: "idle" | "generating" | "reviewing";
  generatedAt: Date | null;
}

export interface FlashcardActions {
  setCards: (cards: Flashcard[]) => void;
  setMode: (mode: FlashcardSessionState["mode"]) => void;
  flipCard: () => void;
  nextCard: () => void;
  previousCard: () => void;
}
