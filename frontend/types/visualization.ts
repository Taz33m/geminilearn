export interface VisualizationState {
  imageData: string | null; // Base64 data URL
  description: string | null; // Description used for generation
  generatedAt: Date | null;
  mode: 'idle' | 'generating' | 'ready';
}

export interface VisualizationActions {
  setVisualization: (imageData: string, description: string) => void;
  setMode: (mode: VisualizationState['mode']) => void;
  clearVisualization: () => void;
}

