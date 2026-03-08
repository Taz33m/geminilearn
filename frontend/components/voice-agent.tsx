'use client';

import { useEffect, useMemo } from "react";
import { VoiceToolEvent, useVoiceAgent } from "@/hooks/useVoiceAgent";
import { FlashcardSessionState, FlashcardActions } from "@/types/flashcard";
import { VisualizationState, VisualizationActions } from "@/types/visualization";
import { DeepDiveState, DeepDiveActions } from "@/types/deepdive";

const statusText: Record<string, string> = {
  idle: "Idle",
  "requesting-permission": "Requesting microphone",
  connecting: "Connecting",
  connected: "Connected",
  error: "Error",
};

const statusStyles: Record<string, string> = {
  idle: "bg-brand-gray-medium/20 text-brand-gray-medium",
  "requesting-permission": "bg-brand-orange-light/20 text-brand-orange-dark",
  connecting: "bg-brand-orange-dark/20 text-brand-orange-dark",
  connected: "bg-brand-orange-light/20 text-brand-orange-dark",
  error: "bg-brand-orange-dark/20 text-brand-orange-dark",
};

const descriptionText: Record<string, string> = {
  idle: "Start the voice agent to begin a live conversation.",
  "requesting-permission":
    "Please grant microphone access so we can connect you to the agent.",
  connecting: "Establishing a secure connection to the voice agent...",
  connected: "You're connected. You can start speaking with the agent.",
  error: "Something went wrong while connecting to the agent.",
};

interface VoiceAgentProps {
  flashcardSession: FlashcardSessionState;
  flashcardActions: FlashcardActions;
  visualizationState: VisualizationState;
  visualizationActions: VisualizationActions;
  deepDiveState: DeepDiveState;
  deepDiveActions: DeepDiveActions;
  setContentView: (view: 'flashcards' | 'visualization' | 'deepdive') => void;
  onToolEvent?: (event: VoiceToolEvent) => void;
  onStatusChange?: (status: string) => void;
}

const VoiceAgent = ({
  flashcardSession,
  flashcardActions,
  visualizationState,
  visualizationActions,
  deepDiveState,
  deepDiveActions,
  setContentView,
  onToolEvent,
  onStatusChange,
}: VoiceAgentProps) => {
  const {
    status,
    error,
    isMicrophoneReady,
    isMicMuted,
    connectAgent,
    disconnectAgent,
    toggleMic,
  } = useVoiceAgent(
    flashcardSession,
    flashcardActions,
    visualizationState,
    visualizationActions,
    deepDiveState,
    deepDiveActions,
    setContentView,
    onToolEvent,
  );

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  const isConnected = status === "connected";
  const isBusy =
    status === "requesting-permission" || status === "connecting";

  const actionLabel = useMemo(() => {
    if (isBusy) return "Connecting...";
    return isConnected ? "Disconnect" : "Start Voice Agent";
  }, [isBusy, isConnected]);

  return (
    <div className="w-full">
      <div className="space-y-3 rounded-xl border border-brand-gray-medium/20 bg-white p-5 shadow-sm">
        <p className="text-xs leading-relaxed text-brand-gray-medium">{descriptionText[status]}</p>

        <button
          type="button"
          onClick={() => {
            if (isConnected) {
              disconnectAgent();
            } else {
              connectAgent();
            }
          }}
          disabled={isBusy}
          className={`block w-full rounded-lg px-4 py-3 text-sm font-semibold shadow-md transition-all duration-200 ${
            isConnected
              ? "bg-brand-orange-dark text-white hover:bg-brand-orange-light hover:shadow-lg focus-visible:outline-2 focus-visible:outline-brand-orange-dark focus-visible:outline-offset-2"
              : "bg-brand-gray-dark text-white hover:bg-brand-gray-medium hover:shadow-lg focus-visible:outline-2 focus-visible:outline-brand-gray-dark focus-visible:outline-offset-2"
          } ${isBusy ? "cursor-not-allowed opacity-70" : "active:scale-[0.98]"}`}
        >
          {actionLabel}
        </button>

        <button
          type="button"
          onClick={toggleMic}
          disabled={!isConnected}
          className={`block w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            isConnected
              ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
          }`}
        >
          {isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
        </button>

        {/* Status Row: Status Badge + Microphone Status */}
        <div className="flex items-center justify-between gap-3">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium shadow-sm transition-all ${statusStyles[status]}`}>
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current animate-pulse" />
            {statusText[status]}
          </div>

          <div className="flex items-center gap-2 text-xs text-brand-gray-medium">
            <span
              className={`inline-flex h-2 w-2 rounded-full transition-all ${
                isMicrophoneReady ? "bg-brand-orange-light shadow-sm shadow-brand-orange-light/50" : "bg-brand-gray-medium/40"
              }`}
            />
            Microphone{" "}
            {isMicrophoneReady
              ? isMicMuted
                ? "muted"
                : "ready"
              : "not granted"}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-brand-orange-dark/30 bg-brand-orange-dark/10 px-4 py-2.5 text-xs text-brand-orange-dark shadow-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceAgent;
