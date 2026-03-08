'use client';

import { Flashcard, FlashcardSessionState } from "@/types/flashcard";
import { FlashcardCard } from "@/components/flashcard-card";
import { cn } from "@/lib/utils";

interface FlashcardPanelProps {
  cards: Flashcard[];
  mode: FlashcardSessionState["mode"];
  currentIndex: number;
  isFlipped: boolean;
  flipCard: () => void;
  nextCard: () => void;
  previousCard: () => void;
}

export const FlashcardPanel = ({
  cards,
  mode,
  currentIndex,
  isFlipped,
  flipCard,
  nextCard,
  previousCard,
}: FlashcardPanelProps) => {
  const currentCard = cards[currentIndex];

  if (mode === "generating") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-brand-gray-medium/20 bg-white/80 p-8 text-sm text-brand-gray-medium shadow-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-gray-medium/20 border-t-brand-gray-dark" />
        <span className="font-medium">Generating flashcards…</span>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="rounded-xl border border-brand-gray-medium/20 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-brand-gray-dark mb-4">What you can do:</p>
        <ul className="space-y-2 text-xs text-brand-gray-medium">
          <li className="flex items-start gap-2">
            <span className="text-brand-orange-light mt-1">•</span>
            <span><strong>Generate Flashcards:</strong> &quot;Generate flashcards on [topic]&quot;</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-orange-light mt-1">•</span>
            <span><strong>Deep Dive:</strong> &quot;Give me a deep dive on [topic]&quot;</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-orange-light mt-1">•</span>
            <span><strong>Visualizations:</strong> &quot;Generate a visualization of [topic]&quot;</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-orange-light mt-1">•</span>
            <span><strong>Canvas Analysis:</strong> &quot;What did I draw?&quot; or &quot;Analyze my drawing&quot;</span>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <FlashcardCard card={currentCard} isFlipped={isFlipped} />

      <div className="flex items-center justify-between text-xs font-medium text-brand-gray-medium/70">
        <span>
          {currentIndex + 1} / {cards.length}
        </span>
        <span className="uppercase tracking-wide">{isFlipped ? 'Answer' : 'Prompt'}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <button
          type="button"
          onClick={previousCard}
          disabled={currentIndex === 0}
          className={cn(
            'rounded-lg border border-brand-gray-medium/20 bg-white px-3 py-2.5 font-medium text-brand-gray-medium transition-all duration-200 hover:border-brand-gray-medium/40 hover:text-brand-gray-dark hover:shadow-sm active:scale-[0.98]',
            currentIndex === 0 && 'pointer-events-none opacity-40'
          )}
        >
          ← Previous
        </button>
        <button
          type="button"
          onClick={flipCard}
          className="rounded-lg border border-brand-gray-medium/20 bg-brand-gray-dark px-3 py-2.5 font-semibold text-white shadow-md transition-all duration-200 hover:bg-brand-gray-medium hover:shadow-lg active:scale-[0.98]"
        >
          Flip
        </button>
        <button
          type="button"
          onClick={nextCard}
          disabled={currentIndex === cards.length - 1}
          className={cn(
            'rounded-lg border border-brand-gray-medium/20 bg-white px-3 py-2.5 font-medium text-brand-gray-medium transition-all duration-200 hover:border-brand-gray-medium/40 hover:text-brand-gray-dark hover:shadow-sm active:scale-[0.98]',
            currentIndex === cards.length - 1 && 'pointer-events-none opacity-40'
          )}
        >
          Next →
        </button>
      </div>
    </section>
  );
};
