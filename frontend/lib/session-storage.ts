import type {
  ContentView,
  SessionArtifact,
  SessionEvent,
  TutorSession,
} from "@/types/session";
import type { DeepDiveState } from "@/types/deepdive";
import type { FlashcardSessionState } from "@/types/flashcard";
import type { VisualizationState } from "@/types/visualization";
import { generateDeterministicSummary } from "@/lib/session-summary";

const STORAGE_KEY = "geminilearn.sessions.v1";
const MAX_SESSIONS = 30;

const toSafeDate = (value: unknown) => {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
};

const coerceContentView = (value: unknown): ContentView => {
  if (
    value === "flashcards" ||
    value === "visualization" ||
    value === "deepdive"
  ) {
    return value;
  }
  return "flashcards";
};

const normalizeFlashcardSession = (value: unknown): FlashcardSessionState => {
  const candidate = (value ?? {}) as Partial<FlashcardSessionState>;
  return {
    cards: Array.isArray(candidate.cards) ? candidate.cards : [],
    currentIndex:
      typeof candidate.currentIndex === "number" ? candidate.currentIndex : 0,
    isFlipped: Boolean(candidate.isFlipped),
    mode:
      candidate.mode === "generating" || candidate.mode === "reviewing"
        ? candidate.mode
        : "idle",
    generatedAt: candidate.generatedAt ? toSafeDate(candidate.generatedAt) : null,
  };
};

const normalizeVisualization = (value: unknown): VisualizationState => {
  const candidate = (value ?? {}) as Partial<VisualizationState>;
  return {
    imageData: typeof candidate.imageData === "string" ? candidate.imageData : null,
    description:
      typeof candidate.description === "string" ? candidate.description : null,
    generatedAt: candidate.generatedAt ? toSafeDate(candidate.generatedAt) : null,
    mode:
      candidate.mode === "generating" || candidate.mode === "ready"
        ? candidate.mode
        : "idle",
  };
};

const normalizeDeepDive = (value: unknown): DeepDiveState => {
  const candidate = (value ?? {}) as Partial<DeepDiveState>;
  return {
    imageData: typeof candidate.imageData === "string" ? candidate.imageData : null,
    overviewText:
      typeof candidate.overviewText === "string" ? candidate.overviewText : null,
    topic: typeof candidate.topic === "string" ? candidate.topic : null,
    generatedAt: candidate.generatedAt ? toSafeDate(candidate.generatedAt) : null,
    mode:
      candidate.mode === "generating" || candidate.mode === "ready"
        ? candidate.mode
        : "idle",
  };
};

const normalizeEvent = (event: unknown): SessionEvent | null => {
  if (!event || typeof event !== "object") return null;
  const candidate = event as Partial<SessionEvent>;

  const validType =
    candidate.type === "session_started" ||
    candidate.type === "session_ended" ||
    candidate.type === "tool_called" ||
    candidate.type === "tool_result" ||
    candidate.type === "artifact_created" ||
    candidate.type === "view_changed" ||
    candidate.type === "note";

  if (!validType || typeof candidate.text !== "string") {
    return null;
  }
  const eventType = candidate.type as SessionEvent["type"];

  return {
    id:
      typeof candidate.id === "string" && candidate.id.length > 0
        ? candidate.id
        : `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: eventType,
    timestamp: toSafeDate(candidate.timestamp),
    text: candidate.text,
    metadata:
      candidate.metadata && typeof candidate.metadata === "object"
        ? (candidate.metadata as Record<string, unknown>)
        : undefined,
  };
};

const normalizeArtifact = (artifact: unknown): SessionArtifact | null => {
  if (!artifact || typeof artifact !== "object") return null;
  const candidate = artifact as Partial<SessionArtifact>;
  const artifactRecord = artifact as Record<string, unknown>;

  if (typeof candidate.title !== "string") return null;
  if (
    candidate.type !== "flashcard_deck" &&
    candidate.type !== "visualization_image" &&
    candidate.type !== "deep_dive_bundle"
  ) {
    return null;
  }

  const base = {
    id:
      typeof candidate.id === "string" && candidate.id.length > 0
        ? candidate.id
        : `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: candidate.type,
    title: candidate.title,
    createdAt: toSafeDate(candidate.createdAt),
    summary: typeof candidate.summary === "string" ? candidate.summary : "",
  };

  if (candidate.type === "flashcard_deck") {
    return {
      ...base,
      type: "flashcard_deck",
      cardCount:
        typeof artifactRecord.cardCount === "number"
          ? artifactRecord.cardCount
          : 0,
    };
  }

  if (candidate.type === "visualization_image") {
    return {
      ...base,
      type: "visualization_image",
      description:
        typeof artifactRecord.description === "string"
          ? artifactRecord.description
          : "",
      imageData:
        typeof artifactRecord.imageData === "string"
          ? artifactRecord.imageData
          : "",
    };
  }

  return {
    ...base,
    type: "deep_dive_bundle",
    topic: typeof artifactRecord.topic === "string" ? artifactRecord.topic : "",
    overviewText:
      typeof artifactRecord.overviewText === "string"
        ? artifactRecord.overviewText
        : "",
    imageData:
      typeof artifactRecord.imageData === "string"
        ? artifactRecord.imageData
        : "",
  };
};

export const loadTutorSessions = (): TutorSession[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((session) => {
        if (!session || typeof session !== "object") return null;
        const candidate = session as Partial<TutorSession>;

        if (typeof candidate.id !== "string" || typeof candidate.title !== "string") {
          return null;
        }

        return {
          id: candidate.id,
          title: candidate.title,
          summary: typeof candidate.summary === "string" ? candidate.summary : "",
          status: candidate.status === "ended" ? "ended" : "active",
          createdAt: toSafeDate(candidate.createdAt),
          updatedAt: toSafeDate(candidate.updatedAt),
          endedAt: candidate.endedAt ? toSafeDate(candidate.endedAt) : null,
          events: Array.isArray(candidate.events)
            ? candidate.events.map(normalizeEvent).filter(Boolean) as SessionEvent[]
            : [],
          artifacts: Array.isArray(candidate.artifacts)
            ? candidate.artifacts
                .map(normalizeArtifact)
                .filter(Boolean) as SessionArtifact[]
            : [],
          snapshot: {
            contentView: coerceContentView(candidate.snapshot?.contentView),
            flashcardSession: normalizeFlashcardSession(
              candidate.snapshot?.flashcardSession,
            ),
            visualizationState: normalizeVisualization(
              candidate.snapshot?.visualizationState,
            ),
            deepDiveState: normalizeDeepDive(candidate.snapshot?.deepDiveState),
          },
        } satisfies TutorSession;
      })
      .filter(Boolean) as TutorSession[];
  } catch {
    return [];
  }
};

export const saveTutorSessions = (sessions: TutorSession[]) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        sessions
          .slice(0, MAX_SESSIONS)
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
      ),
    );
  } catch {
    // Intentionally ignore storage write errors.
  }
};

export const buildSessionSummary = (session: TutorSession) => {
  return generateDeterministicSummary(session).text;
};

export const createSessionId = () =>
  `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createEventId = () =>
  `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createArtifactId = () =>
  `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
