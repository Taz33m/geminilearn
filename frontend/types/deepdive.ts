export interface DeepDiveState {
  imageData: string | null; // Base64 data URL
  overviewText: string | null; // Formatted text (max 100 words)
  topic: string | null; // Topic name (for display)
  generatedAt: Date | null;
  mode: 'idle' | 'generating' | 'ready';
}

export interface DeepDiveActions {
  setDeepDive: (imageData: string, overviewText: string, topic: string) => void;
  setMode: (mode: DeepDiveState['mode']) => void;
  clearDeepDive: () => void;
}

