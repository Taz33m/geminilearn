import type { DeepDiveState } from "../types/deepdive";
import type { FlashcardSessionState } from "../types/flashcard";
import type { TutorSession } from "../types/session";
import type { VisualizationState } from "../types/visualization";

export type WorkspaceTabId =
  | "canvas"
  | "flashcards"
  | "visualization"
  | "deepdive"
  | "sheets"
  | "docs"
  | "slides"
  | "quiz";

export interface WorkspaceTab {
  id: WorkspaceTabId;
  label: string;
  kind: "canvas" | "artifact";
}

interface BuildWorkspaceTabsInput {
  flashcardSession: FlashcardSessionState;
  visualizationState: VisualizationState;
  deepDiveState: DeepDiveState;
  activeSession: TutorSession | null;
}

const hasKeyword = (value: string, keywords: readonly string[]) =>
  keywords.some((keyword) => value.includes(keyword));

const matchesSessionKeyword = (
  activeSession: TutorSession | null,
  keywords: readonly string[],
) => {
  if (!activeSession) return false;

  const byEvent = activeSession.events.some((event) => {
    const toolName = String(event.metadata?.toolName ?? "").toLowerCase();
    return hasKeyword(toolName, keywords);
  });

  const byArtifact = activeSession.artifacts.some((artifact) => {
    const combined = `${artifact.type} ${artifact.title} ${artifact.summary}`.toLowerCase();
    return hasKeyword(combined, keywords);
  });

  return byEvent || byArtifact;
};

export const hasSheetsArtifact = (activeSession: TutorSession | null) =>
  matchesSessionKeyword(activeSession, ["sheet", "spreadsheet", "excel"]);

export const hasDocsArtifact = (activeSession: TutorSession | null) =>
  matchesSessionKeyword(activeSession, ["doc", "memo", "document"]);

export const hasSlidesArtifact = (activeSession: TutorSession | null) =>
  matchesSessionKeyword(activeSession, ["slide", "presentation", "ppt"]);

export const hasQuizArtifact = (activeSession: TutorSession | null) =>
  matchesSessionKeyword(activeSession, ["quiz", "assessment", "test", "exam"]);

export const buildWorkspaceTabs = ({
  flashcardSession,
  visualizationState,
  deepDiveState,
  activeSession,
}: BuildWorkspaceTabsInput): WorkspaceTab[] => {
  const next: WorkspaceTab[] = [{ id: "canvas", label: "Canvas", kind: "canvas" }];

  if (flashcardSession.mode !== "idle" || flashcardSession.cards.length > 0) {
    next.push({ id: "flashcards", label: "Flashcards", kind: "artifact" });
  }
  if (visualizationState.mode !== "idle" || Boolean(visualizationState.imageData)) {
    next.push({ id: "visualization", label: "Visualization", kind: "artifact" });
  }
  if (deepDiveState.mode !== "idle" || Boolean(deepDiveState.imageData)) {
    next.push({ id: "deepdive", label: "Deep Dive", kind: "artifact" });
  }
  if (hasSheetsArtifact(activeSession)) {
    next.push({ id: "sheets", label: "Google Sheets", kind: "artifact" });
  }
  if (hasDocsArtifact(activeSession)) {
    next.push({ id: "docs", label: "Google Docs", kind: "artifact" });
  }
  if (hasSlidesArtifact(activeSession)) {
    next.push({ id: "slides", label: "Google Slides", kind: "artifact" });
  }
  if (hasQuizArtifact(activeSession)) {
    next.push({ id: "quiz", label: "Quiz", kind: "artifact" });
  }

  return next;
};
