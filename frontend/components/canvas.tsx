'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import '@tldraw/tldraw/tldraw.css';
import type { Editor } from '@tldraw/tldraw';

// Dynamically import Tldraw to avoid SSR issues
const Tldraw = dynamic(
  () => import('@tldraw/tldraw').then((mod) => mod.Tldraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-white via-white to-white">
        <div className="text-center">
          <div className="mb-4 inline-flex h-12 w-12 animate-spin items-center justify-center rounded-full border-4 border-brand-gray-medium/20 border-t-brand-gray-dark"></div>
          <p className="text-lg text-brand-gray-medium">Loading canvas...</p>
        </div>
      </div>
    ),
  }
);

// Export editor ref for external access (for testing and future tool)
export const canvasEditorRef = { current: null as Editor | null };

export default function Canvas() {
  const [editor, setEditor] = useState<Editor | null>(null);

  // Update global ref when editor changes
  useEffect(() => {
    canvasEditorRef.current = editor;
  }, [editor]);

  return (
    <div className="h-full w-full">
      <Tldraw onMount={(editorInstance) => setEditor(editorInstance)} />
    </div>
  );
}
