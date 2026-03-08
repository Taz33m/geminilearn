'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import VoiceAgent from "@/components/voice-agent";
import { FlashcardPanel } from "@/components/flashcard-panel";
import { VisualizationPanel } from "@/components/visualization-panel";
import { DeepDivePanel } from "@/components/deepdive-panel";
import Canvas from "@/components/canvas";
import { PanelCard } from "@/components/ui/panel-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import type { VoiceToolEvent } from "@/hooks/useVoiceAgent";
import {
  buildSessionSummary,
  createArtifactId,
  createEventId,
} from "@/lib/session-storage";
import { createSessionEvent, createToolResultEvent } from "@/lib/session-events";
import { applySessionUpdate } from "@/lib/session-update-pipeline";
import {
  ensureSessionSummaries,
  getLocalSessionRepository,
} from "@/lib/session-repository";
import type {
  ContentView,
  GoogleDocArtifact,
  GoogleDocSection,
  GoogleSheetArtifact,
  GoogleSheetTab,
  SessionArtifact,
  SessionEvent,
  TutorSession,
} from "@/types/session";
import { Flashcard, FlashcardSessionState } from "@/types/flashcard";
import { VisualizationState } from "@/types/visualization";
import { DeepDiveState } from "@/types/deepdive";
import { cn } from "@/lib/utils";
import logoImage from "@/logo.png";
import {
  buildWorkspaceTabs,
  type WorkspaceTab,
  type WorkspaceTabId,
} from "@/lib/workspace-tabs";

const SESSION_SIDEBAR_MIN = 280;
const SESSION_SIDEBAR_MAX = 560;
const SESSION_SIDEBAR_DEFAULT = 400;

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

const viewLabel: Record<ContentView, string> = {
  flashcards: "Flashcards",
  visualization: "Visualizations",
  deepdive: "Deep Dive",
};

const buildSnapshot = (
  contentView: ContentView,
  flashcardSession: FlashcardSessionState,
  visualizationState: VisualizationState,
  deepDiveState: DeepDiveState,
) => ({
  contentView,
  flashcardSession,
  visualizationState,
  deepDiveState,
});

const createArtifactEvent = (artifact: SessionArtifact): SessionEvent => ({
  id: createEventId(),
  type: "artifact_created",
  timestamp: new Date(),
  text: `Artifact created: ${artifact.title}`,
  metadata: {
    artifactId: artifact.id,
    artifactType: artifact.type,
  },
});


const TAB_LOGO_BY_ID: Partial<Record<WorkspaceTabId, string>> = {
  docs: "/GDocs.png",
  sheets: "/GSheets.png",
};

const viewToTab: Record<ContentView, WorkspaceTabId> = {
  flashcards: "flashcards",
  visualization: "visualization",
  deepdive: "deepdive",
};

interface SessionWorkspaceProps {
  sessionId: string;
}

export default function SessionWorkspace({ sessionId }: SessionWorkspaceProps) {
  const router = useRouter();
  const repository = useMemo(() => getLocalSessionRepository(), []);

  const [bootstrapState] = useState(() => {
    const loaded = ensureSessionSummaries(repository.list());
    const sessions = loaded.length > 0 ? loaded : [repository.create("Session 1")];
    const active = sessions.find((session) => session.id === sessionId) ?? sessions[0];

    return {
      sessions,
      snapshot: active.snapshot,
    };
  });

  const [sessions, setSessions] = useState<TutorSession[]>(bootstrapState.sessions);
  const [currentContentView, setCurrentContentView] = useState<ContentView>(
    bootstrapState.snapshot.contentView,
  );
  const [flashcardSession, setFlashcardSession] =
    useState<FlashcardSessionState>(bootstrapState.snapshot.flashcardSession);
  const [visualizationState, setVisualizationState] =
    useState<VisualizationState>(bootstrapState.snapshot.visualizationState);
  const [deepDiveState, setDeepDiveState] =
    useState<DeepDiveState>(bootstrapState.snapshot.deepDiveState);
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>(
    viewToTab[bootstrapState.snapshot.contentView] ?? "canvas",
  );
  const [sidebarWidth, setSidebarWidth] = useState(SESSION_SIDEBAR_DEFAULT);
  const [activeSheetName, setActiveSheetName] = useState<string | null>(null);
  const isResizingSidebarRef = useRef(false);

  const artifactMarkerRef = useRef<{
    flashcards: string;
    visualization: string;
    deepdive: string;
  }>({
    flashcards:
      bootstrapState.snapshot.flashcardSession.generatedAt?.toISOString() ?? "",
    visualization:
      bootstrapState.snapshot.visualizationState.generatedAt?.toISOString() ?? "",
    deepdive:
      bootstrapState.snapshot.deepDiveState.generatedAt?.toISOString() ?? "",
  });

  const lastVoiceStatusRef = useRef("idle");
  const lastViewRef = useRef<ContentView>(bootstrapState.snapshot.contentView);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === sessionId) ?? null,
    [sessions, sessionId],
  );

  const latestDocArtifact = useMemo<GoogleDocArtifact | null>(
    () =>
      (activeSession?.artifacts.find(
        (artifact): artifact is GoogleDocArtifact => artifact.type === "google_doc",
      ) ?? null),
    [activeSession],
  );

  const latestSheetArtifact = useMemo<GoogleSheetArtifact | null>(
    () =>
      (activeSession?.artifacts.find(
        (artifact): artifact is GoogleSheetArtifact => artifact.type === "google_sheet",
      ) ?? null),
    [activeSession],
  );

  const activeSheetTab = useMemo(() => {
    if (!latestSheetArtifact || latestSheetArtifact.sheets.length === 0) {
      return null;
    }

    if (activeSheetName) {
      const match = latestSheetArtifact.sheets.find((sheet) => sheet.name === activeSheetName);
      if (match) {
        return match;
      }
    }

    return latestSheetArtifact.sheets[0];
  }, [latestSheetArtifact, activeSheetName]);

  useEffect(() => {
    if (activeSession) {
      return;
    }
    router.replace(`/sessions/${sessions[0].id}`);
  }, [activeSession, sessions, router]);

  useEffect(() => {
    repository.saveAll(ensureSessionSummaries(sessions));
  }, [sessions, repository]);


  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingSidebarRef.current) return;
      const nextWidth = Math.min(
        SESSION_SIDEBAR_MAX,
        Math.max(SESSION_SIDEBAR_MIN, event.clientX),
      );
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      if (!isResizingSidebarRef.current) return;
      isResizingSidebarRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const startSidebarResize = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      isResizingSidebarRef.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [],
  );

  const persistActiveUpdate = useCallback(
    ({
      nextContentView,
      nextFlashcardSession,
      nextVisualizationState,
      nextDeepDiveState,
      appendEvent,
      appendArtifact,
      nextStatus,
      nextEndedAt,
      nextSummary,
    }: {
      nextContentView?: ContentView;
      nextFlashcardSession?: FlashcardSessionState;
      nextVisualizationState?: VisualizationState;
      nextDeepDiveState?: DeepDiveState;
      appendEvent?: SessionEvent;
      appendArtifact?: SessionArtifact;
      nextStatus?: TutorSession["status"];
      nextEndedAt?: Date | null;
      nextSummary?: string;
    }) => {
      const snapshot = buildSnapshot(
        nextContentView ?? currentContentView,
        nextFlashcardSession ?? flashcardSession,
        nextVisualizationState ?? visualizationState,
        nextDeepDiveState ?? deepDiveState,
      );

      setSessions((prev) =>
        applySessionUpdate({
          sessions: prev,
          sessionId,
          snapshot,
          appendEvent,
          appendArtifact,
          nextStatus,
          nextEndedAt,
          nextSummary,
        }),
      );
    },
    [
      sessionId,
      currentContentView,
      flashcardSession,
      visualizationState,
      deepDiveState,
    ],
  );

  const pushSessionEvent = useCallback(
    (type: SessionEvent["type"], text: string, metadata?: Record<string, unknown>) => {
      persistActiveUpdate({
        appendEvent: createSessionEvent(type, text, metadata),
      });
    },
    [persistActiveUpdate],
  );

  const endSession = useCallback(() => {
    if (!activeSession || activeSession.status === "ended") return;

    const now = new Date();
    const endedSession: TutorSession = {
      ...activeSession,
      status: "ended",
      endedAt: now,
      updatedAt: now,
      events: [
        ...activeSession.events,
        {
          id: createEventId(),
          type: "session_ended",
          timestamp: now,
          text: "Session ended.",
        },
      ],
    };

    persistActiveUpdate({
      nextStatus: "ended",
      nextEndedAt: now,
      nextSummary: buildSessionSummary(endedSession),
      appendEvent: {
        id: createEventId(),
        type: "session_ended",
        timestamp: now,
        text: "Session ended.",
      },
    });
  }, [activeSession, persistActiveUpdate]);

  // Auto-switch to the artifact tab as soon as its mode becomes non-idle.
  // This is more reliable than relying on the tool handler closure calling
  // setContentView at the right moment relative to React's batch schedule.
  useEffect(() => {
    if (flashcardSession.mode !== "idle") {
      setActiveTab("flashcards");
    }
  }, [flashcardSession.mode]);

  useEffect(() => {
    if (visualizationState.mode !== "idle") {
      setActiveTab("visualization");
    }
  }, [visualizationState.mode]);

  useEffect(() => {
    if (deepDiveState.mode !== "idle") {
      setActiveTab("deepdive");
    }
  }, [deepDiveState.mode]);

  const setContentView = useCallback(
    (view: ContentView) => {
      setCurrentContentView(view);
      setActiveTab(viewToTab[view]);

      if (view !== lastViewRef.current) {
        lastViewRef.current = view;
        pushSessionEvent("view_changed", `Switched to ${viewLabel[view]} view.`);
      }

      persistActiveUpdate({ nextContentView: view });
    },
    [persistActiveUpdate, pushSessionEvent],
  );

  const handleSetCards = useCallback(
    (cards: Flashcard[]) => {
      const nextState: FlashcardSessionState = {
        cards,
        currentIndex: 0,
        isFlipped: false,
        mode: cards.length > 0 ? "reviewing" : "idle",
        generatedAt: cards.length > 0 ? new Date() : null,
      };

      setFlashcardSession(nextState);

      if (!nextState.generatedAt || cards.length === 0) {
        persistActiveUpdate({ nextFlashcardSession: nextState });
        return;
      }

      const marker = nextState.generatedAt.toISOString();
      if (artifactMarkerRef.current.flashcards !== marker) {
        artifactMarkerRef.current.flashcards = marker;

        const artifact: SessionArtifact = {
          id: createArtifactId(),
          type: "flashcard_deck",
          title: cards[0]?.title ? `Flashcards: ${cards[0].title}` : "Flashcard Deck",
          createdAt: nextState.generatedAt,
          summary: `Generated ${cards.length} flashcards.`,
          cardCount: cards.length,
        };

        persistActiveUpdate({
          nextFlashcardSession: nextState,
          appendArtifact: artifact,
          appendEvent: createArtifactEvent(artifact),
        });
        return;
      }

      persistActiveUpdate({ nextFlashcardSession: nextState });
    },
    [persistActiveUpdate],
  );

  const handleSetMode = useCallback(
    (mode: FlashcardSessionState["mode"]) => {
      const next = {
        ...flashcardSession,
        mode,
      };
      setFlashcardSession(next);
      persistActiveUpdate({ nextFlashcardSession: next });
    },
    [flashcardSession, persistActiveUpdate],
  );

  const handleFlipCard = useCallback(() => {
    const next = {
      ...flashcardSession,
      isFlipped: !flashcardSession.isFlipped,
    };
    setFlashcardSession(next);
    persistActiveUpdate({ nextFlashcardSession: next });
  }, [flashcardSession, persistActiveUpdate]);

  const handleNextCard = useCallback(() => {
    if (flashcardSession.currentIndex >= flashcardSession.cards.length - 1) return;
    const next = {
      ...flashcardSession,
      currentIndex: flashcardSession.currentIndex + 1,
      isFlipped: false,
    };
    setFlashcardSession(next);
    persistActiveUpdate({ nextFlashcardSession: next });
  }, [flashcardSession, persistActiveUpdate]);

  const handlePreviousCard = useCallback(() => {
    if (flashcardSession.currentIndex === 0) return;
    const next = {
      ...flashcardSession,
      currentIndex: flashcardSession.currentIndex - 1,
      isFlipped: false,
    };
    setFlashcardSession(next);
    persistActiveUpdate({ nextFlashcardSession: next });
  }, [flashcardSession, persistActiveUpdate]);

  const flashcardActions = useMemo(
    () => ({
      setCards: handleSetCards,
      setMode: handleSetMode,
      flipCard: handleFlipCard,
      nextCard: handleNextCard,
      previousCard: handlePreviousCard,
    }),
    [handleSetCards, handleSetMode, handleFlipCard, handleNextCard, handlePreviousCard],
  );

  const handleSetVisualization = useCallback(
    (imageData: string, description: string) => {
      const next: VisualizationState = {
        imageData,
        description,
        generatedAt: new Date(),
        mode: "ready",
      };
      setVisualizationState(next);

      const marker = next.generatedAt?.toISOString() ?? "";
      if (marker && artifactMarkerRef.current.visualization !== marker) {
        artifactMarkerRef.current.visualization = marker;

        const artifact: SessionArtifact = {
          id: createArtifactId(),
          type: "visualization_image",
          title: description ? `Visualization: ${description}` : "Visualization",
          createdAt: next.generatedAt as Date,
          summary: "Generated a visualization image.",
          description,
          imageData,
        };

        persistActiveUpdate({
          nextVisualizationState: next,
          appendArtifact: artifact,
          appendEvent: createArtifactEvent(artifact),
        });
        return;
      }

      persistActiveUpdate({ nextVisualizationState: next });
    },
    [persistActiveUpdate],
  );

  const handleSetVisualizationMode = useCallback(
    (mode: VisualizationState["mode"]) => {
      const next = {
        ...visualizationState,
        mode,
      };
      setVisualizationState(next);
      persistActiveUpdate({ nextVisualizationState: next });
    },
    [visualizationState, persistActiveUpdate],
  );

  const handleClearVisualization = useCallback(() => {
    setVisualizationState(INITIAL_VISUALIZATION_STATE);
    persistActiveUpdate({ nextVisualizationState: INITIAL_VISUALIZATION_STATE });
  }, [persistActiveUpdate]);

  const visualizationActions = useMemo(
    () => ({
      setVisualization: handleSetVisualization,
      setMode: handleSetVisualizationMode,
      clearVisualization: handleClearVisualization,
    }),
    [handleSetVisualization, handleSetVisualizationMode, handleClearVisualization],
  );

  const handleSetDeepDive = useCallback(
    (imageData: string, overviewText: string, topic: string) => {
      const next: DeepDiveState = {
        imageData,
        overviewText,
        topic,
        generatedAt: new Date(),
        mode: "ready",
      };
      setDeepDiveState(next);

      const marker = next.generatedAt?.toISOString() ?? "";
      if (marker && artifactMarkerRef.current.deepdive !== marker) {
        artifactMarkerRef.current.deepdive = marker;

        const artifact: SessionArtifact = {
          id: createArtifactId(),
          type: "deep_dive_bundle",
          title: topic ? `Deep Dive: ${topic}` : "Deep Dive",
          createdAt: next.generatedAt as Date,
          summary: overviewText,
          topic,
          overviewText,
          imageData,
        };

        persistActiveUpdate({
          nextDeepDiveState: next,
          appendArtifact: artifact,
          appendEvent: createArtifactEvent(artifact),
        });
        return;
      }

      persistActiveUpdate({ nextDeepDiveState: next });
    },
    [persistActiveUpdate],
  );

  const handleSetDeepDiveMode = useCallback(
    (mode: DeepDiveState["mode"]) => {
      const next = {
        ...deepDiveState,
        mode,
      };
      setDeepDiveState(next);
      persistActiveUpdate({ nextDeepDiveState: next });
    },
    [deepDiveState, persistActiveUpdate],
  );

  const handleClearDeepDive = useCallback(() => {
    setDeepDiveState(INITIAL_DEEPDIVE_STATE);
    persistActiveUpdate({ nextDeepDiveState: INITIAL_DEEPDIVE_STATE });
  }, [persistActiveUpdate]);

  const deepDiveActions = useMemo(
    () => ({
      setDeepDive: handleSetDeepDive,
      setMode: handleSetDeepDiveMode,
      clearDeepDive: handleClearDeepDive,
    }),
    [handleSetDeepDive, handleSetDeepDiveMode, handleClearDeepDive],
  );

  const handleSetGoogleDoc = useCallback(
    (title: string, summary: string, sections: GoogleDocSection[]) => {
      const artifact: SessionArtifact = {
        id: createArtifactId(),
        type: "google_doc",
        title,
        createdAt: new Date(),
        summary,
        sections,
      };
      persistActiveUpdate({
        appendArtifact: artifact,
        appendEvent: createArtifactEvent(artifact),
      });
      setActiveTab("docs");
    },
    [persistActiveUpdate],
  );

  const handleSetGoogleSheet = useCallback(
    (title: string, summary: string, sheets: GoogleSheetTab[]) => {
      const artifact: SessionArtifact = {
        id: createArtifactId(),
        type: "google_sheet",
        title,
        createdAt: new Date(),
        summary,
        sheets,
      };
      persistActiveUpdate({
        appendArtifact: artifact,
        appendEvent: createArtifactEvent(artifact),
      });
      setActiveTab("sheets");
    },
    [persistActiveUpdate],
  );

  const handleVoiceToolEvent = useCallback(
    (event: VoiceToolEvent) => {
      persistActiveUpdate({
        appendEvent: createToolResultEvent({
          toolName: event.toolName,
          args: event.args,
          success: event.success,
          message: event.message,
        }),
      });
    },
    [persistActiveUpdate],
  );

  const handleVoiceStatusChange = useCallback(
    (status: string) => {
      if (status === lastVoiceStatusRef.current) return;

      if (status === "connected") {
        pushSessionEvent("note", "Voice agent connected.");
      } else if (status === "idle" && lastVoiceStatusRef.current === "connected") {
        pushSessionEvent("note", "Voice agent disconnected.");
      } else if (status === "error") {
        pushSessionEvent("note", "Voice agent entered an error state.");
      }

      lastVoiceStatusRef.current = status;
    },
    [pushSessionEvent],
  );

  const tabs = useMemo<WorkspaceTab[]>(
    () =>
      buildWorkspaceTabs({
        flashcardSession,
        visualizationState,
        deepDiveState,
        activeSession,
      }),
    [flashcardSession, visualizationState, deepDiveState, activeSession],
  );

  const activeTabId = tabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : "canvas";

  const isFreshSession = useMemo(() => {
    if (!activeSession) return false;
    return (
      activeSession.artifacts.length === 0 &&
      activeSession.events.length <= 1 &&
      flashcardSession.cards.length === 0 &&
      flashcardSession.mode === "idle" &&
      !visualizationState.imageData &&
      visualizationState.mode === "idle" &&
      !deepDiveState.imageData &&
      deepDiveState.mode === "idle"
    );
  }, [
    activeSession,
    flashcardSession.cards.length,
    flashcardSession.mode,
    visualizationState.imageData,
    visualizationState.mode,
    deepDiveState.imageData,
    deepDiveState.mode,
  ]);

  const handleTabSelect = (tabId: WorkspaceTabId) => {
    setActiveTab(tabId);
    if (tabId === "flashcards") {
      setContentView("flashcards");
    } else if (tabId === "visualization") {
      setContentView("visualization");
    } else if (tabId === "deepdive") {
      setContentView("deepdive");
    }
  };

  const renderMainTab = () => {
    if (activeTabId === "canvas") {
      return <Canvas />;
    }

    if (activeTabId === "flashcards") {
      return (
        <div className="p-4">
          <FlashcardPanel
            key={
              flashcardSession.generatedAt
                ? flashcardSession.generatedAt.toISOString()
                : "idle"
            }
            cards={flashcardSession.cards}
            mode={flashcardSession.mode}
            currentIndex={flashcardSession.currentIndex}
            isFlipped={flashcardSession.isFlipped}
            flipCard={handleFlipCard}
            nextCard={handleNextCard}
            previousCard={handlePreviousCard}
          />
        </div>
      );
    }

    if (activeTabId === "visualization") {
      return (
        <div className="p-4">
          <VisualizationPanel visualization={visualizationState} />
        </div>
      );
    }

    if (activeTabId === "deepdive") {
      return (
        <div className="p-4">
          <DeepDivePanel deepDive={deepDiveState} />
        </div>
      );
    }

    if (activeTabId === "sheets") {
      return (
        <div className="p-6">
          <PanelCard>
            <SectionHeader
              title={latestSheetArtifact?.title ?? "Google Sheets"}
              subtitle={latestSheetArtifact?.summary ?? "Spreadsheet artifact"}
            />
            {!latestSheetArtifact || latestSheetArtifact.sheets.length === 0 ? (
              <p className="text-sm text-slate-600">
                No spreadsheet artifact yet. Ask the voice agent to create a Google Sheet.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {latestSheetArtifact.sheets.map((sheet) => (
                    <button
                      key={sheet.name}
                      type="button"
                      onClick={() => setActiveSheetName(sheet.name)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium",
                        activeSheetTab?.name === sheet.name
                          ? "border-slate-400 bg-slate-100 text-slate-900"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      {sheet.name}
                    </button>
                  ))}
                </div>
                {activeSheetTab ? (
                  <div className="overflow-auto rounded-lg border border-slate-200">
                    <table className="min-w-full border-collapse text-sm">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          {activeSheetTab.columns.map((column) => (
                            <th
                              key={column}
                              className="border-b border-slate-200 px-3 py-2 text-left font-semibold"
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeSheetTab.rows.map((row, rowIndex) => (
                          <tr key={`row-${rowIndex}`} className="odd:bg-white even:bg-slate-50">
                            {row.map((cell, cellIndex) => (
                              <td
                                key={`cell-${rowIndex}-${cellIndex}`}
                                className="border-b border-slate-100 px-3 py-2 align-top text-slate-700"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            )}
          </PanelCard>
        </div>
      );
    }

    if (activeTabId === "docs") {
      return (
        <div className="p-6">
          <PanelCard>
            <SectionHeader
              title={latestDocArtifact?.title ?? "Google Docs"}
              subtitle={latestDocArtifact?.summary ?? "Memo artifact"}
            />
            {!latestDocArtifact || latestDocArtifact.sections.length === 0 ? (
              <p className="text-sm text-slate-600">
                No document artifact yet. Ask the voice agent to create a Google Doc memo.
              </p>
            ) : (
              <div className="space-y-4">
                {latestDocArtifact.sections.map((section, index) => (
                  <section key={`section-${index}`} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">{section.heading}</h3>
                    <p className="text-sm leading-relaxed text-slate-700">{section.content}</p>
                    {section.bullets.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                        {section.bullets.map((item, itemIndex) => (
                          <li key={`bullet-${index}-${itemIndex}`}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ))}
              </div>
            )}
          </PanelCard>
        </div>
      );
    }

    if (activeTabId === "quiz") {
      return (
        <div className="p-6">
          <PanelCard>
            <SectionHeader title="Quiz" subtitle="Assessment artifact tab" />
            <p className="text-sm text-slate-600">
              Quiz artifacts will render here when generated by tools.
            </p>
          </PanelCard>
        </div>
      );
    }

    return <Canvas />;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <aside
        style={{ width: sidebarWidth }}
        className="relative h-full shrink-0 overflow-y-auto border-r border-slate-200 bg-white"
      >
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                aria-label="Back to dashboard"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                ←
              </button>
              <Image
                src={logoImage}
                alt="Geminilearn"
                width={38}
                height={38}
                className="rounded-lg border border-slate-200 object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">Geminilearn</p>
                <p className="text-xs text-slate-500">Tutor Session</p>
              </div>
            </div>
          </div>

          {!isFreshSession ? (
            <PanelCard>
              <SectionHeader
                title="Session"
                right={<StatusBadge status={activeSession?.status ?? "idle"} />}
              />
              <button
                type="button"
                onClick={endSession}
                disabled={activeSession?.status !== "active"}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                End Session
              </button>
            </PanelCard>
          ) : null}

          <PanelCard>
            <VoiceAgent
              flashcardSession={flashcardSession}
              flashcardActions={flashcardActions}
              visualizationState={visualizationState}
              visualizationActions={visualizationActions}
              deepDiveState={deepDiveState}
              deepDiveActions={deepDiveActions}
              setContentView={setContentView}
              onSetGoogleDoc={handleSetGoogleDoc}
              onSetGoogleSheet={handleSetGoogleSheet}
              onToolEvent={handleVoiceToolEvent}
              onStatusChange={handleVoiceStatusChange}
            />
          </PanelCard>
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={startSidebarResize}
          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
        />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-slate-100 px-2 py-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabSelect(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-t-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                activeTabId === tab.id
                  ? "border-slate-300 border-b-white bg-white text-slate-900"
                  : "border-transparent bg-slate-200 text-slate-600 hover:bg-slate-300",
              )}
            >
              {TAB_LOGO_BY_ID[tab.id] ? (
                <Image
                  src={TAB_LOGO_BY_ID[tab.id] as string}
                  alt=""
                  width={14}
                  height={14}
                  aria-hidden
                  className="h-3.5 w-3.5 object-contain"
                />
              ) : (
                <span
                  className={cn(
                    "inline-block h-2 w-2 rounded-full",
                    tab.kind === "canvas" ? "bg-indigo-500" : "bg-emerald-500",
                  )}
                />
              )}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">{renderMainTab()}</div>
      </section>
    </div>
  );
}
