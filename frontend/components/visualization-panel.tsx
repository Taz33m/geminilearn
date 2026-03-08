'use client';

import { useState } from 'react';
import Image from 'next/image';
import { VisualizationState } from '@/types/visualization';
import { copyImageToClipboard } from '@/lib/clipboard';

interface VisualizationPanelProps {
  visualization: VisualizationState;
}

export const VisualizationPanel = ({ visualization }: VisualizationPanelProps) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleCopyToClipboard = async () => {
    if (!visualization.imageData) return;

    try {
      await copyImageToClipboard(visualization.imageData);
      setCopyStatus('copied');
      // Reset status after 3 seconds
      setTimeout(() => setCopyStatus('idle'), 3000);
    } catch (error) {
      console.error('[visualization] Copy failed:', error);
      setCopyStatus('error');
      // Reset status after 3 seconds
      setTimeout(() => setCopyStatus('idle'), 3000);
    }
  };

  if (visualization.mode === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-brand-gray-medium/20 bg-white/80 p-8 text-sm text-brand-gray-medium shadow-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-gray-medium/20 border-t-brand-gray-dark" />
        <span className="font-medium">Generating visualization…</span>
      </div>
    );
  }

  if (!visualization.imageData) {
    return (
      <div className="rounded-xl border border-dashed border-brand-gray-medium/20 bg-white/60 p-8 text-center text-sm text-brand-gray-medium shadow-sm">
        <p className="font-medium">No visualization generated yet.</p>
        <p className="mt-3 text-xs leading-relaxed">
          Ask the voice agent to generate a visualization or illustration.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-brand-gray-medium/20 bg-white overflow-hidden shadow-md">
        <div className="relative h-[360px] w-full">
          <Image
            src={visualization.imageData}
            alt={visualization.description || 'Generated visualization'}
            fill
            unoptimized
            sizes="(max-width: 1024px) 100vw, 720px"
            className="object-contain"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopyToClipboard}
        className={`w-full rounded-lg px-4 py-3 text-sm font-semibold shadow-md transition-all duration-200 active:scale-[0.98] ${
          copyStatus === 'copied'
            ? 'bg-brand-orange-light text-white hover:bg-brand-orange-dark hover:shadow-lg'
            : copyStatus === 'error'
            ? 'bg-brand-orange-dark text-white hover:bg-brand-orange-light hover:shadow-lg'
            : 'bg-brand-gray-dark text-white hover:bg-brand-gray-medium hover:shadow-lg'
        }`}
      >
        {copyStatus === 'copied'
          ? '✓ Copied to Clipboard!'
          : copyStatus === 'error'
          ? '✗ Copy Failed - Try Again'
          : 'Copy to Clipboard'}
      </button>

      {copyStatus === 'copied' && (
        <div className="rounded-lg border border-brand-orange-light/30 bg-brand-orange-light/10 px-4 py-3 text-xs text-brand-orange-dark shadow-sm">
          <p className="font-semibold">Image copied!</p>
          <p className="mt-1.5 text-brand-orange-dark leading-relaxed">
            Press <kbd className="px-2 py-1 rounded bg-brand-orange-light/20 border border-brand-orange-light/30 font-mono text-[10px] shadow-sm">Cmd+V</kbd> or <kbd className="px-2 py-1 rounded bg-brand-orange-light/20 border border-brand-orange-light/30 font-mono text-[10px] shadow-sm">Ctrl+V</kbd> on the canvas to paste
          </p>
        </div>
      )}
      
      {visualization.description && (
        <div className="rounded-lg border border-brand-gray-medium/20 bg-white p-4 text-xs text-brand-gray-medium shadow-sm">
          <p className="font-semibold text-brand-gray-dark mb-2">Description:</p>
          <p className="leading-relaxed">{visualization.description}</p>
        </div>
      )}
    </section>
  );
};
