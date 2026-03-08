import { describe, expect, it } from "vitest";
import {
  buildWorkspaceTabs,
  hasDocsArtifact,
  hasQuizArtifact,
  hasSheetsArtifact,
  hasSlidesArtifact,
} from "../lib/workspace-tabs";
import type { DeepDiveState } from "../types/deepdive";
import type { FlashcardSessionState } from "../types/flashcard";
import type { SessionEvent, TutorSession } from "../types/session";
import type { VisualizationState } from "../types/visualization";

const NOW = new Date("2026-03-08T12:00:00.000Z");

const IDLE_FLASHCARDS: FlashcardSessionState = {
  cards: [],
  currentIndex: 0,
  isFlipped: false,
  mode: "idle",
  generatedAt: null,
};

const IDLE_VISUALIZATION: VisualizationState = {
  imageData: null,
  description: null,
  generatedAt: null,
  mode: "idle",
};

const IDLE_DEEPDIVE: DeepDiveState = {
  imageData: null,
  overviewText: null,
  topic: null,
  generatedAt: null,
  mode: "idle",
};

const createEvent = (
  toolName: string,
  type: SessionEvent["type"] = "tool_result",
): SessionEvent => ({
  id: `event-${toolName}`,
  type,
  timestamp: NOW,
  text: `Tool result for ${toolName}`,
  metadata: {
    toolName,
  },
});

const createSession = (overrides?: Partial<TutorSession>): TutorSession => ({
  id: "session-1",
  title: "Session 1",
  summary: "",
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
  endedAt: null,
  events: [],
  artifacts: [],
  snapshot: {
    contentView: "flashcards",
    flashcardSession: IDLE_FLASHCARDS,
    visualizationState: IDLE_VISUALIZATION,
    deepDiveState: IDLE_DEEPDIVE,
  },
  ...overrides,
});

describe("tool event tab detection", () => {
  it("adds Docs tab from tool event metadata", () => {
    const session = createSession({
      events: [createEvent("create_google_doc")],
    });

    expect(hasDocsArtifact(session)).toBe(true);
    const tabs = buildWorkspaceTabs({
      flashcardSession: IDLE_FLASHCARDS,
      visualizationState: IDLE_VISUALIZATION,
      deepDiveState: IDLE_DEEPDIVE,
      activeSession: session,
    });

    expect(tabs.map((tab) => tab.id)).toContain("docs");
  });

  it("adds Sheets tab from artifact text", () => {
    const session = createSession({
      artifacts: [
        {
          id: "artifact-sheet",
          type: "flashcard_deck",
          title: "Quarterly Spreadsheet",
          createdAt: NOW,
          summary: "Contains budget sheet and forecasts",
          cardCount: 0,
        },
      ],
    });

    expect(hasSheetsArtifact(session)).toBe(true);
    const tabs = buildWorkspaceTabs({
      flashcardSession: IDLE_FLASHCARDS,
      visualizationState: IDLE_VISUALIZATION,
      deepDiveState: IDLE_DEEPDIVE,
      activeSession: session,
    });

    expect(tabs.map((tab) => tab.id)).toContain("sheets");
  });

  it("adds Slides and Quiz tabs from event keywords", () => {
    const session = createSession({
      events: [createEvent("build_presentation"), createEvent("generate_quiz")],
    });

    expect(hasSlidesArtifact(session)).toBe(true);
    expect(hasQuizArtifact(session)).toBe(true);
    const tabs = buildWorkspaceTabs({
      flashcardSession: IDLE_FLASHCARDS,
      visualizationState: IDLE_VISUALIZATION,
      deepDiveState: IDLE_DEEPDIVE,
      activeSession: session,
    });

    expect(tabs.map((tab) => tab.id)).toEqual(["canvas", "slides", "quiz"]);
  });

  it("never includes replay tab", () => {
    const session = createSession({
      events: [createEvent("generate_flashcards")],
    });

    const tabs = buildWorkspaceTabs({
      flashcardSession: {
        ...IDLE_FLASHCARDS,
        mode: "reviewing",
      },
      visualizationState: {
        ...IDLE_VISUALIZATION,
        mode: "ready",
        imageData: "data:image/png;base64,abc",
      },
      deepDiveState: IDLE_DEEPDIVE,
      activeSession: session,
    });

    const tabIds = tabs.map((tab) => tab.id as string);
    expect(tabIds).not.toContain("replay");
  });

  it("keeps stable tab order across content and tool artifacts", () => {
    const session = createSession({
      events: [createEvent("GOOGLE_DOC"), createEvent("EXCEL_SHEET"), createEvent("pptx_export"), createEvent("exam_builder")],
    });

    const tabs = buildWorkspaceTabs({
      flashcardSession: {
        ...IDLE_FLASHCARDS,
        mode: "reviewing",
      },
      visualizationState: {
        ...IDLE_VISUALIZATION,
        mode: "ready",
        imageData: "data:image/png;base64,vis",
      },
      deepDiveState: {
        ...IDLE_DEEPDIVE,
        mode: "ready",
        imageData: "data:image/png;base64,deep",
      },
      activeSession: session,
    });

    expect(tabs.map((tab) => tab.id)).toEqual([
      "canvas",
      "flashcards",
      "visualization",
      "deepdive",
      "sheets",
      "docs",
      "slides",
      "quiz",
    ]);
  });
});
