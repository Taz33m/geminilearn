import type { DeepDiveState } from "@/types/deepdive";
import type { FlashcardSessionState } from "@/types/flashcard";
import type { VisualizationState } from "@/types/visualization";
import type { ContentView, TutorSession } from "@/types/session";
import {
  buildSessionSummary,
  createEventId,
  createSessionId,
  loadTutorSessions,
  saveTutorSessions,
} from "@/lib/session-storage";

const MAX_SESSIONS = 30;

const INITIAL_FLASHCARD_STATE: FlashcardSessionState = {
  cards: [],
  currentIndex: 0,
  isFlipped: false,
  mode: "idle",
  generatedAt: null,
};

const INITIAL_VISUALIZATION_STATE: VisualizationState = {
  imageData: null,
  description: null,
  generatedAt: null,
  mode: "idle",
};

const INITIAL_DEEPDIVE_STATE: DeepDiveState = {
  imageData: null,
  overviewText: null,
  topic: null,
  generatedAt: null,
  mode: "idle",
};

const buildSnapshot = (
  contentView: ContentView = "flashcards",
): TutorSession["snapshot"] => ({
  contentView,
  flashcardSession: INITIAL_FLASHCARD_STATE,
  visualizationState: INITIAL_VISUALIZATION_STATE,
  deepDiveState: INITIAL_DEEPDIVE_STATE,
});

const createSessionTitle = (sessions: TutorSession[]) => {
  return `Session ${sessions.length + 1}`;
};

export const createTutorSession = (
  sessions: TutorSession[],
  title?: string,
): TutorSession => {
  const now = new Date();
  return {
    id: createSessionId(),
    title: title?.trim() || createSessionTitle(sessions),
    summary: "Session started; no artifacts generated yet.",
    status: "active",
    createdAt: now,
    updatedAt: now,
    endedAt: null,
    events: [
      {
        id: createEventId(),
        type: "session_started",
        timestamp: now,
        text: "Session started.",
      },
    ],
    artifacts: [],
    snapshot: buildSnapshot(),
  };
};

export interface SessionRepository {
  list(): TutorSession[];
  getById(sessionId: string): TutorSession | null;
  create(title?: string): TutorSession;
  saveAll(sessions: TutorSession[]): void;
  upsert(session: TutorSession): TutorSession[];
  delete(sessionId: string): TutorSession[];
}

class LocalSessionRepository implements SessionRepository {
  list(): TutorSession[] {
    return loadTutorSessions();
  }

  getById(sessionId: string): TutorSession | null {
    return this.list().find((session) => session.id === sessionId) ?? null;
  }

  create(title?: string): TutorSession {
    const existing = this.list();
    const session = createTutorSession(existing, title);
    this.saveAll([session, ...existing]);
    return session;
  }

  saveAll(sessions: TutorSession[]): void {
    saveTutorSessions(sessions.slice(0, MAX_SESSIONS));
  }

  upsert(session: TutorSession): TutorSession[] {
    const existing = this.list();
    const next = existing.some((item) => item.id === session.id)
      ? existing.map((item) => (item.id === session.id ? session : item))
      : [session, ...existing];
    this.saveAll(next);
    return next;
  }

  delete(sessionId: string): TutorSession[] {
    const next = this.list().filter((session) => session.id !== sessionId);
    this.saveAll(next);
    return next;
  }
}

let localRepository: SessionRepository | null = null;

export const getLocalSessionRepository = (): SessionRepository => {
  if (!localRepository) {
    localRepository = new LocalSessionRepository();
  }
  return localRepository;
};

export const ensureSessionSummaries = (sessions: TutorSession[]): TutorSession[] => {
  return sessions.map((session) => ({
    ...session,
    summary: buildSessionSummary(session),
  }));
};
