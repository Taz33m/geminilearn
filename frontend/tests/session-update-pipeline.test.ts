import { describe, expect, it } from "vitest";
import { createSessionEvent, createToolResultEvent } from "../lib/session-events";
import { applySessionUpdate } from "../lib/session-update-pipeline";
import type { TutorSession } from "../types/session";

const NOW = new Date("2026-03-08T12:00:00.000Z");

const createFlashcardArtifact = (id: string) => ({
  id,
  type: "flashcard_deck" as const,
  title: `Deck ${id}`,
  createdAt: NOW,
  summary: "Generated flashcards.",
  cardCount: 5,
});

const createSession = (overrides?: Partial<TutorSession>): TutorSession => ({
  id: "session-1",
  title: "Session 1",
  summary: "Session started; no artifacts generated yet.",
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
  endedAt: null,
  events: [
    {
      id: "event-started",
      type: "session_started",
      timestamp: NOW,
      text: "Session started.",
    },
  ],
  artifacts: [],
  snapshot: {
    contentView: "flashcards",
    flashcardSession: {
      cards: [],
      currentIndex: 0,
      isFlipped: false,
      mode: "idle",
      generatedAt: null,
    },
    visualizationState: {
      imageData: null,
      description: null,
      generatedAt: null,
      mode: "idle",
    },
    deepDiveState: {
      imageData: null,
      overviewText: null,
      topic: null,
      generatedAt: null,
      mode: "idle",
    },
  },
  ...overrides,
});

describe("session update pipeline", () => {
  it("appends voice tool-result events with expected metadata", () => {
    const session = createSession();
    const toolResult = createToolResultEvent(
      {
        toolName: "generate_flashcards",
        args: { topic: "photosynthesis" },
        success: true,
        message: "Generated 5 cards.",
      },
      NOW,
    );

    const [updated] = applySessionUpdate({
      sessions: [session],
      sessionId: session.id,
      snapshot: session.snapshot,
      appendEvent: toolResult,
      updatedAt: NOW,
    });

    const lastEvent = updated.events[updated.events.length - 1];
    expect(lastEvent.type).toBe("tool_result");
    expect(lastEvent.text).toContain("Completed generate_flashcards");
    expect(lastEvent.metadata).toMatchObject({
      toolName: "generate_flashcards",
      success: true,
    });
  });

  it("caps artifacts at 24 and keeps newest first", () => {
    const existingArtifacts = Array.from({ length: 24 }, (_, index) =>
      createFlashcardArtifact(`old-${index}`),
    );
    const session = createSession({ artifacts: existingArtifacts });
    const newest = createFlashcardArtifact("newest");

    const [updated] = applySessionUpdate({
      sessions: [session],
      sessionId: session.id,
      snapshot: session.snapshot,
      appendArtifact: newest,
      appendEvent: createSessionEvent("artifact_created", "Artifact created: newest", {
        artifactId: newest.id,
      }, NOW),
      updatedAt: NOW,
    });

    expect(updated.artifacts).toHaveLength(24);
    expect(updated.artifacts[0].id).toBe("newest");
    expect(updated.artifacts.some((artifact) => artifact.id === "old-23")).toBe(false);
  });

  it("recomputes deterministic summary after artifact creation", () => {
    const session = createSession();
    const artifact = createFlashcardArtifact("deck-1");

    const [updated] = applySessionUpdate({
      sessions: [session],
      sessionId: session.id,
      snapshot: session.snapshot,
      appendArtifact: artifact,
      updatedAt: NOW,
    });

    expect(updated.summary).toBe("Session produced 1 flashcard deck.");
  });

  it("updates status and endedAt for session end event", () => {
    const endedAt = new Date("2026-03-08T12:30:00.000Z");
    const session = createSession();

    const [updated] = applySessionUpdate({
      sessions: [session],
      sessionId: session.id,
      snapshot: session.snapshot,
      nextStatus: "ended",
      nextEndedAt: endedAt,
      appendEvent: createSessionEvent("session_ended", "Session ended.", undefined, endedAt),
      updatedAt: endedAt,
    });

    expect(updated.status).toBe("ended");
    expect(updated.endedAt).toEqual(endedAt);
    expect(updated.events[updated.events.length - 1].type).toBe("session_ended");
  });
});
