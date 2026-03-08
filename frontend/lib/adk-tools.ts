'use client';

import { FunctionTool } from '@google/adk';
import type { RunAsyncToolRequest } from '@google/adk';
import { Type } from '@google/genai';
import type { Editor } from '@tldraw/tldraw';

import { playToolCue } from '@/lib/audio';
import { captureCanvasScreenshot } from '@/lib/canvas-snapshot';
import type { FlashcardActions, FlashcardSessionState } from '@/types/flashcard';
import type { VisualizationActions } from '@/types/visualization';
import type { DeepDiveActions } from '@/types/deepdive';
import type { GoogleDocSection, GoogleSheetTab } from '@/types/session';

export interface AdkToolContext {
  flashcardActions: FlashcardActions;
  getFlashcardSession: () => FlashcardSessionState;
  visualizationActions: VisualizationActions;
  deepDiveActions: DeepDiveActions;
  getCanvasEditor: () => Editor | null;
  setContentView: (view: 'flashcards' | 'visualization' | 'deepdive') => void;
  onSetGoogleDoc?: (title: string, summary: string, sections: GoogleDocSection[]) => void;
  onSetGoogleSheet?: (title: string, summary: string, sheets: GoogleSheetTab[]) => void;
}

// Our execute functions never use toolContext; pass a stub to satisfy the interface.
const STUB_CTX = {} as RunAsyncToolRequest['toolContext'];

// Shorthand for optional string property schema
const optStr = (description: string) => ({ type: Type.STRING, description });
const reqStr = (description: string) => ({ type: Type.STRING, description });

export function createAdkTools(ctx: AdkToolContext): FunctionTool[] {
  const {
    flashcardActions,
    getFlashcardSession,
    visualizationActions,
    deepDiveActions,
    getCanvasEditor,
    setContentView,
    onSetGoogleDoc,
    onSetGoogleSheet,
  } = ctx;

  return [
    // ── Flashcards ──────────────────────────────────────────────────────────

    new FunctionTool({
      name: 'generate_flashcards',
      description: 'Generate a deck of study flashcards for a requested topic. MUST be called whenever the user asks for flashcards.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          topic: reqStr('Topic for the flashcard deck.'),
          focus: optStr('Optional focus area for the deck.'),
        },
        required: ['topic'],
      },
      execute: async (args: unknown) => {
        const { topic, focus } = args as { topic: string; focus?: string };
        console.log('[adk-tools] generate_flashcards', { topic, focus });
        try {
          setContentView('flashcards');
          flashcardActions.setMode('generating');
          const res = await fetch('/api/generate-flashcards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, focus }),
          });
          const payload = await res.json();
          if (!res.ok || payload.success === false) throw new Error(payload.error ?? 'Failed');
          flashcardActions.setCards(payload.flashcards);
          const result = { success: true, count: payload.flashcards.length, message: `Generated ${payload.flashcards.length} flashcards on ${topic}.` };
          playToolCue(result);
          return result;
        } catch (err) {
          flashcardActions.setMode('idle');
          const result = { success: false, message: err instanceof Error ? err.message : 'Unknown error' };
          playToolCue(result);
          return result;
        }
      },
    }),

    new FunctionTool({
      name: 'get_current_flashcard_context',
      description: 'Get information about the current flashcard being reviewed.',
      parameters: { type: Type.OBJECT, properties: {} },
      execute: async (_args: unknown) => {
        const session = getFlashcardSession();
        if (session.cards.length === 0) return { success: false, available: false, message: 'No flashcards loaded.' };
        const card = session.cards[session.currentIndex];
        const position = `${session.currentIndex + 1} of ${session.cards.length}`;
        return {
          success: true, available: true,
          title: card.title, question: card.question, coreIdea: card.coreIdea,
          isFlipped: session.isFlipped,
          answer: session.isFlipped ? card.answer : '[hidden - do not reveal]',
          position,
          message: `Current card: "${card.title}" (${position}). ${session.isFlipped ? 'Answer revealed.' : 'Showing question.'}`,
        };
      },
    }),

    new FunctionTool({
      name: 'flip_flashcard',
      description: 'Flip the current flashcard to show or hide the answer.',
      parameters: { type: Type.OBJECT, properties: {} },
      execute: async (_args: unknown) => {
        flashcardActions.flipCard();
        const result = { success: true, message: 'Card flipped.' };
        playToolCue(result);
        return result;
      },
    }),

    new FunctionTool({
      name: 'next_flashcard',
      description: 'Move to the next flashcard.',
      parameters: { type: Type.OBJECT, properties: {} },
      execute: async (_args: unknown) => {
        flashcardActions.nextCard();
        const result = { success: true, message: 'Moved to next card.' };
        playToolCue(result);
        return result;
      },
    }),

    new FunctionTool({
      name: 'previous_flashcard',
      description: 'Move to the previous flashcard.',
      parameters: { type: Type.OBJECT, properties: {} },
      execute: async (_args: unknown) => {
        flashcardActions.previousCard();
        const result = { success: true, message: 'Moved to previous card.' };
        playToolCue(result);
        return result;
      },
    }),

    // ── Canvas ───────────────────────────────────────────────────────────────

    new FunctionTool({
      name: 'get_canvas_snapshot',
      description: 'Capture the current canvas drawing as an image for analysis.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          conversationContext: optStr('Context about the ongoing conversation.'),
        },
      },
      execute: async (args: unknown) => {
        const { conversationContext } = args as { conversationContext?: string };
        const editor = getCanvasEditor();
        if (!editor) return { success: false, message: 'Canvas not available.' };
        try {
          const imageData = await captureCanvasScreenshot(editor);
          return { success: true, imageData, conversationContext, message: 'Canvas captured.' };
        } catch {
          return { success: false, message: 'Failed to capture canvas.' };
        }
      },
    }),

    // ── Visualization ────────────────────────────────────────────────────────

    ...(['generate_visualization', 'generate_diagram'] as const).map((toolName) =>
      new FunctionTool({
        name: toolName,
        description: 'Generate an educational visualization image or diagram.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            imageDescription: optStr('Detailed description of the image/diagram.'),
            topic: optStr('Short topic name.'),
            includeCanvasImage: { type: Type.BOOLEAN, description: 'Include the current canvas drawing as additional context.' },
          },
        },
        execute: async (args: unknown) => {
          const { imageDescription, topic, includeCanvasImage } = args as { imageDescription?: string; topic?: string; includeCanvasImage?: boolean };
          const description = imageDescription ?? (topic ? `Create a clear educational diagram about ${topic} with labeled parts, directional arrows, and concise annotations.` : undefined);
          if (!description) return { success: false, message: 'Provide a description or topic.' };
          try {
            visualizationActions.setMode('generating');
            setContentView('visualization');
            let canvasImageData: string | undefined;
            if (includeCanvasImage) {
              const editor = getCanvasEditor();
              if (editor) { try { canvasImageData = await captureCanvasScreenshot(editor); } catch {} }
            }
            const res = await fetch('/api/generate-visualization', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageDescription: description, canvasImageData }),
            });
            const payload = await res.json();
            if (!res.ok || payload.success === false) throw new Error(payload.error ?? 'Failed');
            visualizationActions.setVisualization(payload.imageData, description);
            visualizationActions.setMode('ready');
            const result = { success: true, message: 'Visualization generated.' };
            playToolCue(result);
            return result;
          } catch (err) {
            visualizationActions.setMode('idle');
            const result = { success: false, message: err instanceof Error ? err.message : 'Unknown error' };
            playToolCue(result);
            return result;
          }
        },
      })
    ),

    new FunctionTool({
      name: 'show_flashcards',
      description: 'Switch the view back to flashcards.',
      parameters: { type: Type.OBJECT, properties: {} },
      execute: async (_args: unknown) => {
        setContentView('flashcards');
        const result = { success: true, message: 'Switched to flashcards.' };
        playToolCue(result);
        return result;
      },
    }),

    // ── Deep Dive ────────────────────────────────────────────────────────────

    new FunctionTool({
      name: 'generate_deep_dive',
      description: 'Generate a comprehensive deep-dive overview with image for a topic.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          topic: reqStr('Topic for the deep dive, including any relevant context.'),
        },
        required: ['topic'],
      },
      execute: async (args: unknown) => {
        const { topic } = args as { topic: string };
        try {
          deepDiveActions.setMode('generating');
          setContentView('deepdive');
          const res = await fetch('/api/generate-deep-dive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic }),
          });
          const payload = await res.json();
          if (!res.ok || payload.success === false) throw new Error(payload.error ?? 'Failed');
          deepDiveActions.setDeepDive(payload.imageData, payload.overviewText, topic);
          const result = { success: true, message: 'Deep dive generated.' };
          playToolCue(result);
          return result;
        } catch (err) {
          deepDiveActions.setMode('idle');
          const result = { success: false, message: err instanceof Error ? err.message : 'Unknown error' };
          playToolCue(result);
          return result;
        }
      },
    }),

    // ── Artifacts ────────────────────────────────────────────────────────────

    new FunctionTool({
      name: 'create_google_doc',
      description: 'Create a Google Docs-style memo artifact for the current topic.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          topic: reqStr('Topic to create a document for.'),
          purpose: optStr('Optional purpose of the memo.'),
          audience: optStr('Optional target audience.'),
        },
        required: ['topic'],
      },
      execute: async (args: unknown) => {
        const { topic, purpose, audience } = args as { topic: string; purpose?: string; audience?: string };
        try {
          const res = await fetch('/api/generate-google-doc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, purpose, audience }),
          });
          const payload = await res.json();
          if (!res.ok || payload.success === false) throw new Error(payload.error ?? 'Failed');
          onSetGoogleDoc?.(payload.title as string, payload.summary as string, payload.sections);
          const result = { success: true, message: `Created Google Doc: ${payload.title}` };
          playToolCue(result);
          return result;
        } catch (err) {
          const result = { success: false, message: err instanceof Error ? err.message : 'Unknown error' };
          playToolCue(result);
          return result;
        }
      },
    }),

    new FunctionTool({
      name: 'create_google_sheet',
      description: 'Create a Google Sheets-style spreadsheet artifact for structured data.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          topic: reqStr('Topic to convert to spreadsheet data.'),
          objective: optStr('Optional objective for the sheet.'),
        },
        required: ['topic'],
      },
      execute: async (args: unknown) => {
        const { topic, objective } = args as { topic: string; objective?: string };
        try {
          const res = await fetch('/api/generate-google-sheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, objective }),
          });
          const payload = await res.json();
          if (!res.ok || payload.success === false) throw new Error(payload.error ?? 'Failed');
          onSetGoogleSheet?.(payload.title as string, payload.summary as string, payload.sheets);
          const result = { success: true, message: `Created Google Sheet: ${payload.title}` };
          playToolCue(result);
          return result;
        } catch (err) {
          const result = { success: false, message: err instanceof Error ? err.message : 'Unknown error' };
          playToolCue(result);
          return result;
        }
      },
    }),
  ];
}

/** Dispatch a tool call by name through the ADK FunctionTool map. */
export async function runAdkTool(
  toolMap: Map<string, FunctionTool>,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ success: boolean; message: string; [key: string]: unknown }> {
  const tool = toolMap.get(toolName);
  if (!tool) return { success: false, message: `No handler for tool: ${toolName}` };
  const result = await tool.runAsync({ args, toolContext: STUB_CTX });
  return result as { success: boolean; message: string; [key: string]: unknown };
}
