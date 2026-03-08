'use client';

import { Flashcard } from '@/types/flashcard';
import { cn } from '@/lib/utils';

interface FlashcardCardProps {
  card: Flashcard;
  isFlipped: boolean;
  className?: string;
}

export const FlashcardCard = ({ card, isFlipped, className }: FlashcardCardProps) => {
  return (
    <div className={cn('relative h-64 w-full perspective-1200', className)}>
      <div
        className={cn(
          'relative h-full w-full rounded-2xl transition-transform duration-500 ease-out transform-style-3d',
          isFlipped ? 'rotate-y-180' : 'rotate-y-0'
        )}
      >
        {/* Front */}
        <article className="absolute inset-0 flex h-full w-full flex-col justify-between rounded-2xl border border-brand-gray-medium/20 bg-white p-6 shadow-xl shadow-brand-gray-medium/10 backface-hidden transition-shadow hover:shadow-2xl">
          <header className="space-y-2">
            <h2 className="text-xl font-semibold text-brand-gray-dark leading-tight">{card.title}</h2>
            <p className="text-sm text-brand-gray-medium leading-relaxed">{card.coreIdea}</p>
          </header>
          <main className="rounded-xl border border-dashed border-brand-gray-medium/20 bg-white p-5 transition-colors hover:border-brand-gray-medium/30">
            <p className="text-sm font-medium text-brand-gray-dark leading-relaxed">{card.question}</p>
          </main>
          <footer />
        </article>

        {/* Back */}
        <article className="absolute inset-0 flex h-full w-full flex-col justify-between rounded-2xl border border-brand-orange-light/30 bg-brand-orange-light/10 p-6 text-brand-gray-dark shadow-xl shadow-brand-orange-light/10 rotate-y-180 backface-hidden transition-shadow hover:shadow-2xl">
          <header className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand-orange-dark">Answer</p>
            <h2 className="text-lg font-semibold leading-tight">{card.title}</h2>
          </header>
          <main className="space-y-3">
            <p className="text-sm leading-relaxed text-brand-gray-dark">{card.answer}</p>
            {card.source && (
              <p className="text-xs text-brand-orange-dark">
                Source: <span className="underline decoration-dotted decoration-brand-orange-dark/50">{card.source}</span>
              </p>
            )}
          </main>
          <footer />
        </article>
      </div>
    </div>
  );
};

