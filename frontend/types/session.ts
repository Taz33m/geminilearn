import type { FlashcardSessionState } from "@/types/flashcard";
import type { VisualizationState } from "@/types/visualization";
import type { DeepDiveState } from "@/types/deepdive";

export type ContentView = "flashcards" | "visualization" | "deepdive";

export type SessionEventType =
  | "session_started"
  | "session_ended"
  | "tool_called"
  | "tool_result"
  | "artifact_created"
  | "view_changed"
  | "note";

export interface SessionEvent {
  id: string;
  type: SessionEventType;
  timestamp: Date;
  text: string;
  metadata?: Record<string, unknown>;
}

export type SessionArtifactType =
  | "flashcard_deck"
  | "visualization_image"
  | "deep_dive_bundle"
  | "google_doc"
  | "google_sheet";

interface SessionArtifactBase {
  id: string;
  type: SessionArtifactType;
  title: string;
  createdAt: Date;
  summary: string;
}

export interface FlashcardDeckArtifact extends SessionArtifactBase {
  type: "flashcard_deck";
  cardCount: number;
}

export interface VisualizationArtifact extends SessionArtifactBase {
  type: "visualization_image";
  description: string;
  imageData: string;
}

export interface DeepDiveArtifact extends SessionArtifactBase {
  type: "deep_dive_bundle";
  topic: string;
  overviewText: string;
  imageData: string;
}

export interface GoogleDocSection {
  heading: string;
  content: string;
  bullets: string[];
}

export interface GoogleDocArtifact extends SessionArtifactBase {
  type: "google_doc";
  sections: GoogleDocSection[];
}

export interface GoogleSheetTab {
  name: string;
  columns: string[];
  rows: string[][];
}

export interface GoogleSheetArtifact extends SessionArtifactBase {
  type: "google_sheet";
  sheets: GoogleSheetTab[];
}

export type SessionArtifact =
  | FlashcardDeckArtifact
  | VisualizationArtifact
  | DeepDiveArtifact
  | GoogleDocArtifact
  | GoogleSheetArtifact;

export interface SessionSnapshot {
  contentView: ContentView;
  flashcardSession: FlashcardSessionState;
  visualizationState: VisualizationState;
  deepDiveState: DeepDiveState;
}

export interface TutorSession {
  id: string;
  title: string;
  summary: string;
  status: "active" | "ended";
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
  events: SessionEvent[];
  artifacts: SessionArtifact[];
  snapshot: SessionSnapshot;
}
