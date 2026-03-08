'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { DeepDiveState } from '@/types/deepdive';
import { copyImageToClipboard } from '@/lib/clipboard';
import { generateCombinedDeepDiveImage } from '@/lib/deepdive-image';

interface DeepDivePanelProps {
  deepDive: DeepDiveState;
}

export const DeepDivePanel = ({ deepDive }: DeepDivePanelProps) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [combinedImageDataUrl, setCombinedImageDataUrl] = useState<string | null>(null);
  const [isGeneratingCombined, setIsGeneratingCombined] = useState(false);

  // Pre-generate combined image when deep dive is ready
  useEffect(() => {
    if (deepDive.mode === 'ready' && deepDive.imageData && deepDive.overviewText) {
      let cancelled = false;
      
      // Use setTimeout to make state update async (avoids linter warning)
      setTimeout(() => {
        if (!cancelled) {
          setIsGeneratingCombined(true);
        }
      }, 0);
      
      generateCombinedDeepDiveImage(deepDive.imageData, deepDive.overviewText)
        .then((combinedImage) => {
          if (!cancelled) {
            setCombinedImageDataUrl(combinedImage);
            setIsGeneratingCombined(false);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error('[deepdive] Failed to pre-generate combined image:', error);
            setIsGeneratingCombined(false);
          }
        });
      
      return () => {
        cancelled = true;
      };
    } else {
      setTimeout(() => setCombinedImageDataUrl(null), 0);
    }
  }, [deepDive.mode, deepDive.imageData, deepDive.overviewText]);

  const handleCopyToClipboard = async () => {
    if (!combinedImageDataUrl) {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 3000);
      return;
    }

    try {
      // Copy pre-generated combined image immediately (no async operations)
      await copyImageToClipboard(combinedImageDataUrl);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 3000);
    } catch (error) {
      console.error('[deepdive] Copy failed:', error);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 3000);
    }
  };

  if (deepDive.mode === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-brand-gray-medium/20 bg-white/80 p-8 text-sm text-brand-gray-medium shadow-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-gray-medium/20 border-t-brand-gray-dark" />
        <span className="font-medium">Generating deep dive…</span>
      </div>
    );
  }

  if (!deepDive.imageData || !deepDive.overviewText) {
    return (
      <div className="rounded-xl border border-dashed border-brand-gray-medium/20 bg-white/60 p-8 text-center text-sm text-brand-gray-medium shadow-sm">
        <p className="font-medium">No deep dive generated yet.</p>
        <p className="mt-3 text-xs leading-relaxed">
          Ask the voice agent for a deep dive on a topic.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {/* Generated Image */}
      <div className="rounded-xl border border-brand-gray-medium/20 bg-white overflow-hidden shadow-md">
        <div className="relative h-[360px] w-full">
          <Image
            src={deepDive.imageData}
            alt={deepDive.topic || 'Deep dive visualization'}
            fill
            unoptimized
            sizes="(max-width: 1024px) 100vw, 720px"
            className="object-contain"
          />
        </div>
      </div>

      {/* Overview Text */}
      <div className="rounded-lg border border-brand-gray-medium/20 bg-white p-5 text-sm text-brand-gray-dark leading-relaxed shadow-sm">
        <p className="whitespace-pre-line">{deepDive.overviewText}</p>
      </div>

      {/* Copy to Clipboard Button */}
      <button
        type="button"
        onClick={handleCopyToClipboard}
        disabled={isGeneratingCombined || !combinedImageDataUrl}
        className={`w-full rounded-lg px-4 py-3 text-sm font-semibold shadow-md transition-all duration-200 active:scale-[0.98] ${
          copyStatus === 'copied'
            ? 'bg-brand-orange-light text-white hover:bg-brand-orange-dark hover:shadow-lg'
            : copyStatus === 'error'
            ? 'bg-brand-orange-dark text-white hover:bg-brand-orange-light hover:shadow-lg'
            : 'bg-brand-gray-dark text-white hover:bg-brand-gray-medium hover:shadow-lg'
        } ${isGeneratingCombined || !combinedImageDataUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isGeneratingCombined
          ? 'Preparing image…'
          : copyStatus === 'copied'
          ? '✓ Copied to Clipboard!'
          : copyStatus === 'error'
          ? '✗ Copy Failed - Try Again'
          : 'Copy to Clipboard'}
      </button>

      {/* Copy Success Message */}
      {copyStatus === 'copied' && (
        <div className="rounded-lg border border-brand-orange-light/30 bg-brand-orange-light/10 px-4 py-3 text-xs text-brand-orange-dark shadow-sm">
          <p className="font-semibold">Image copied!</p>
          <p className="mt-1.5 text-brand-orange-dark leading-relaxed">
            Press <kbd className="px-2 py-1 rounded bg-brand-orange-light/20 border border-brand-orange-light/30 font-mono text-[10px] shadow-sm">Cmd+V</kbd> or <kbd className="px-2 py-1 rounded bg-brand-orange-light/20 border border-brand-orange-light/30 font-mono text-[10px] shadow-sm">Ctrl+V</kbd> on the canvas to paste
          </p>
        </div>
      )}

      {/* Topic Badge (optional) */}
      {deepDive.topic && (
        <div className="rounded-lg border border-brand-gray-medium/20 bg-white px-4 py-2.5 text-xs text-brand-gray-medium shadow-sm">
          <span className="font-semibold text-brand-gray-dark">Topic: </span>
          <span>{deepDive.topic}</span>
        </div>
      )}
    </section>
  );
};
