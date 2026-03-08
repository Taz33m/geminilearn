'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FunctionCall,
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Session,
} from "@google/genai";

import {
  CANVAS_FUNCTION_DECLARATIONS,
  createCanvasToolHandlers,
} from "@/lib/canvas-tools";
import {
  createDeepDiveToolHandlers,
  DEEP_DIVE_FUNCTION_DECLARATIONS,
} from "@/lib/deepdive-tools";
import {
  createFlashcardToolHandlers,
  FLASHCARD_FUNCTION_DECLARATIONS,
  GeminiToolHandler,
} from "@/lib/flashcard-tools";
import {
  createVisualizationToolHandlers,
  VISUALIZATION_FUNCTION_DECLARATIONS,
} from "@/lib/visualization-tools";
import { canvasEditorRef } from "@/components/canvas";
import { FlashcardSessionState, FlashcardActions } from "@/types/flashcard";
import {
  VisualizationState,
  VisualizationActions,
} from "@/types/visualization";
import { DeepDiveState, DeepDiveActions } from "@/types/deepdive";

type VoiceStatus =
  | "idle"
  | "requesting-permission"
  | "connecting"
  | "connected"
  | "error";

export interface VoiceToolEvent {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  success: boolean;
  message: string;
  timestamp: Date;
}

interface EphemeralKeyResponse {
  ephemeralKey: string;
  expiresAt: string;
}

const TOKEN_ENDPOINT = "/api/voice/token";
const LIVE_MODEL =
  process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL ??
  "gemini-2.5-flash-native-audio-preview-12-2025";
const LIVE_ENABLE_SESSION_RESUMPTION =
  process.env.NEXT_PUBLIC_GEMINI_LIVE_ENABLE_SESSION_RESUMPTION !== "false";
const LIVE_CONTEXT_COMPRESSION_TRIGGER =
  process.env.NEXT_PUBLIC_GEMINI_LIVE_CONTEXT_TRIGGER_TOKENS;
const LIVE_CONTEXT_COMPRESSION_TARGET =
  process.env.NEXT_PUBLIC_GEMINI_LIVE_CONTEXT_TARGET_TOKENS;

const FUNCTION_DECLARATIONS = [
  ...FLASHCARD_FUNCTION_DECLARATIONS,
  ...CANVAS_FUNCTION_DECLARATIONS,
  ...VISUALIZATION_FUNCTION_DECLARATIONS,
  ...DEEP_DIVE_FUNCTION_DECLARATIONS,
];

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const float32ToPcm16Base64 = (input: Float32Array): string => {
  const pcm = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    pcm[i] = Math.round(clamp(input[i], -1, 1) * 32767);
  }

  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const base64ToPcm16 = (base64: string): Int16Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Int16Array(bytes.buffer);
};

const parseSampleRateFromMimeType = (
  mimeType: string | undefined,
  fallback = 24000,
) => {
  if (!mimeType) return fallback;

  const rateMatch = mimeType.match(/(?:rate|sample_rate)=([0-9]+)/i);
  if (!rateMatch) return fallback;

  const parsed = Number.parseInt(rateMatch[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const buildAgentInstructions = (deckSummary: string) => `You are a helpful teaching assistant. Always respond in English.

FLASHCARD MANAGEMENT:
- Only generate flashcards when the user explicitly requests them.
- Call generate_flashcards with topic (and focus if available).
- After generating flashcards, confirm count and ask if the user wants to review.

FLASHCARD NAVIGATION:
- Use get_current_flashcard_context before discussing a card.
- Use flip_flashcard, next_flashcard, previous_flashcard when asked.
- Do not reveal hidden answers unless the card is flipped.

CANVAS AWARENESS:
- Only call get_canvas_snapshot when the user asks about their drawing or canvas content.

VISUALIZATION:
- Use generate_visualization when user asks for an image/diagram.
- Set includeCanvasImage=true only when the user asks to enhance current canvas work.
- Use show_flashcards when user asks to return to flashcards.

DEEP DIVE:
- Use generate_deep_dive when user asks for a deep explanation or comprehensive overview.

ERROR HANDLING:
- If a tool fails, apologize briefly and ask whether they want to retry.

${deckSummary}`;

export const useVoiceAgent = (
  flashcardSession: FlashcardSessionState,
  flashcardActions: FlashcardActions,
  _visualizationState: VisualizationState,
  visualizationActions: VisualizationActions,
  _deepDiveState: DeepDiveState,
  deepDiveActions: DeepDiveActions,
  setContentView: (view: 'flashcards' | 'visualization' | 'deepdive') => void,
  onToolEvent?: (event: VoiceToolEvent) => void,
) => {
  const sessionRef = useRef<Session | null>(null);
  const toolHandlersRef = useRef<Record<string, GeminiToolHandler>>({});
  const sessionResumptionHandleRef = useRef<string | undefined>(undefined);

  const flashcardSessionRef = useRef<FlashcardSessionState>(flashcardSession);
  const statusRef = useRef<VoiceStatus>("idle");
  const isMicMutedRef = useRef(false);
  const setModeRef = useRef<FlashcardActions["setMode"]>(flashcardActions.setMode);

  const micStreamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micSinkRef = useRef<GainNode | null>(null);
  const micSampleRateRef = useRef(16000);

  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackCursorRef = useRef(0);
  const playbackSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isMicrophoneReady, setIsMicrophoneReady] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    flashcardSessionRef.current = flashcardSession;
  }, [flashcardSession]);

  useEffect(() => {
    setModeRef.current = flashcardActions.setMode;
  }, [flashcardActions]);

  const toolHandlers = useMemo(
    () => ({
      ...createFlashcardToolHandlers({
        actions: flashcardActions,
        getFlashcardSession: () => flashcardSessionRef.current,
        setContentView,
      }),
      ...createCanvasToolHandlers({
        getCanvasEditor: () => canvasEditorRef.current,
      }),
      ...createVisualizationToolHandlers({
        getCanvasEditor: () => canvasEditorRef.current,
        actions: visualizationActions,
        setContentView,
      }),
      ...createDeepDiveToolHandlers({
        actions: deepDiveActions,
        setContentView,
      }),
    }),
    [flashcardActions, visualizationActions, deepDiveActions, setContentView],
  );

  useEffect(() => {
    toolHandlersRef.current = toolHandlers;
  }, [toolHandlers]);

  const stopPlaybackQueue = useCallback(() => {
    for (const source of playbackSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // No-op if already stopped.
      }
    }
    playbackSourcesRef.current.clear();

    const playbackContext = playbackContextRef.current;
    if (playbackContext) {
      playbackCursorRef.current = playbackContext.currentTime;
    } else {
      playbackCursorRef.current = 0;
    }
  }, []);

  const closePlayback = useCallback(async () => {
    stopPlaybackQueue();

    if (playbackContextRef.current) {
      try {
        await playbackContextRef.current.close();
      } catch {
        // Ignore close failures on teardown.
      }
    }

    playbackContextRef.current = null;
    playbackCursorRef.current = 0;
  }, [stopPlaybackQueue]);

  const ensurePlaybackContext = useCallback(async () => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new AudioContext();
    }

    if (playbackContextRef.current.state === "suspended") {
      await playbackContextRef.current.resume();
    }

    return playbackContextRef.current;
  }, []);

  const queueAudioForPlayback = useCallback(
    async (base64Data: string, mimeType: string | undefined) => {
      const playbackContext = await ensurePlaybackContext();
      const sampleRate = parseSampleRateFromMimeType(mimeType, 24000);
      const pcm16 = base64ToPcm16(base64Data);
      const float32 = new Float32Array(pcm16.length);

      for (let i = 0; i < pcm16.length; i += 1) {
        float32[i] = pcm16[i] / 32768;
      }

      const audioBuffer = playbackContext.createBuffer(1, float32.length, sampleRate);
      audioBuffer.copyToChannel(float32, 0);

      const source = playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(playbackContext.destination);

      const startTime = Math.max(playbackContext.currentTime, playbackCursorRef.current);
      source.start(startTime);

      playbackCursorRef.current = startTime + audioBuffer.duration;
      playbackSourcesRef.current.add(source);

      source.onended = () => {
        playbackSourcesRef.current.delete(source);
      };
    },
    [ensurePlaybackContext],
  );

  const stopMicrophoneCapture = useCallback(async () => {
    if (micProcessorRef.current) {
      micProcessorRef.current.onaudioprocess = null;
      micProcessorRef.current.disconnect();
      micProcessorRef.current = null;
    }

    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }

    if (micSinkRef.current) {
      micSinkRef.current.disconnect();
      micSinkRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (micContextRef.current) {
      try {
        await micContextRef.current.close();
      } catch {
        // Ignore close failures on teardown.
      }
      micContextRef.current = null;
    }

    setIsMicrophoneReady(false);
  }, []);

  const startMicrophoneCapture = useCallback(async (session: Session) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const micContext = new AudioContext();
    await micContext.resume();

    const source = micContext.createMediaStreamSource(stream);
    const processor = micContext.createScriptProcessor(2048, 1, 1);
    const silentSink = micContext.createGain();
    silentSink.gain.value = 0;

    source.connect(processor);
    processor.connect(silentSink);
    silentSink.connect(micContext.destination);

    micSampleRateRef.current = micContext.sampleRate;

    processor.onaudioprocess = (event) => {
      if (isMicMutedRef.current || statusRef.current !== "connected") {
        return;
      }

      const input = event.inputBuffer.getChannelData(0);
      if (input.length === 0) {
        return;
      }

      session.sendRealtimeInput({
        audio: {
          data: float32ToPcm16Base64(input),
          mimeType: `audio/pcm;rate=${micSampleRateRef.current}`,
        },
      });
    };

    micStreamRef.current = stream;
    micContextRef.current = micContext;
    micSourceRef.current = source;
    micProcessorRef.current = processor;
    micSinkRef.current = silentSink;

    setIsMicrophoneReady(true);
  }, []);

  const handleToolCalls = useCallback(async (functionCalls: FunctionCall[]) => {
    const session = sessionRef.current;
    if (!session || functionCalls.length === 0) {
      return;
    }

    const responses = await Promise.all(
      functionCalls.map(async (call) => {
        const toolName = call.name ?? "";
        const handler = toolHandlersRef.current[toolName];

        if (!handler) {
          const args =
            call.args && typeof call.args === "object"
              ? (call.args as Record<string, unknown>)
              : {};
          onToolEvent?.({
            id: call.id ?? `${toolName}-${Date.now()}`,
            toolName,
            args,
            success: false,
            message: `No handler registered for tool: ${toolName}`,
            timestamp: new Date(),
          });
          return {
            id: call.id,
            name: toolName,
            response: {
              error: `No handler registered for tool: ${toolName}`,
            },
          };
        }

        try {
          const args =
            call.args && typeof call.args === "object"
              ? (call.args as Record<string, unknown>)
              : {};

          const output = await handler(args);
          const success =
            typeof output.success === "boolean" ? output.success : true;
          const message =
            typeof output.message === "string"
              ? output.message
              : success
                ? `${toolName} completed`
                : `${toolName} failed`;

          onToolEvent?.({
            id: call.id ?? `${toolName}-${Date.now()}`,
            toolName,
            args,
            success,
            message,
            timestamp: new Date(),
          });
          return {
            id: call.id,
            name: toolName,
            response: {
              output,
            },
          };
        } catch (toolError) {
          const message =
            toolError instanceof Error ? toolError.message : "Unknown tool error";
          const args =
            call.args && typeof call.args === "object"
              ? (call.args as Record<string, unknown>)
              : {};

          onToolEvent?.({
            id: call.id ?? `${toolName}-${Date.now()}`,
            toolName,
            args,
            success: false,
            message,
            timestamp: new Date(),
          });

          return {
            id: call.id,
            name: toolName,
            response: {
              error: message,
            },
          };
        }
      }),
    );

    session.sendToolResponse({
      functionResponses: responses,
    });
  }, [onToolEvent]);

  const handleServerMessage = useCallback(
    async (message: LiveServerMessage) => {
      const content = message.serverContent;
      const resumptionUpdate = message.sessionResumptionUpdate;

      if (resumptionUpdate?.resumable && resumptionUpdate.newHandle) {
        sessionResumptionHandleRef.current = resumptionUpdate.newHandle;
      }

      if (content?.interrupted) {
        stopPlaybackQueue();
      }

      if (content?.modelTurn?.parts) {
        for (const part of content.modelTurn.parts) {
          const inlineData = part.inlineData;
          if (!inlineData?.data) {
            continue;
          }

          if (inlineData.mimeType?.startsWith("audio/")) {
            await queueAudioForPlayback(inlineData.data, inlineData.mimeType);
          }
        }
      }

      const functionCalls = message.toolCall?.functionCalls ?? [];
      if (functionCalls.length > 0) {
        await handleToolCalls(functionCalls);
      }
    },
    [handleToolCalls, queueAudioForPlayback, stopPlaybackQueue],
  );

  const disconnectAgent = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;

    if (session) {
      try {
        session.close();
      } catch {
        // Ignore close failures on teardown.
      }
    }

    await stopMicrophoneCapture();
    await closePlayback();

    isMicMutedRef.current = false;
    setIsMicMuted(false);
    setModeRef.current("idle");
    setStatus("idle");
    setExpiresAt(null);
  }, [closePlayback, stopMicrophoneCapture]);

  const connectAgent = useCallback(async () => {
    if (statusRef.current === "connecting" || statusRef.current === "connected") {
      return;
    }

    setStatus("requesting-permission");
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setIsMicrophoneReady(true);

      setStatus("connecting");

      const tokenResponse = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to obtain Gemini ephemeral token");
      }

      const { ephemeralKey, expiresAt: expiresAtIso } =
        (await tokenResponse.json()) as EphemeralKeyResponse;

      const cardCount = flashcardSessionRef.current.cards.length;
      const deckSummary = cardCount
        ? `There are currently ${cardCount} flashcards loaded.`
        : "There are currently no flashcards loaded.";

      const ai = new GoogleGenAI({
        apiKey: ephemeralKey,
        apiVersion: "v1alpha",
      });

      const liveConfig = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: buildAgentInstructions(deckSummary),
        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        ...(LIVE_ENABLE_SESSION_RESUMPTION
          ? {
              sessionResumption: {
                handle: sessionResumptionHandleRef.current,
              },
            }
          : {}),
        ...(LIVE_CONTEXT_COMPRESSION_TRIGGER
          ? {
              contextWindowCompression: {
                triggerTokens: LIVE_CONTEXT_COMPRESSION_TRIGGER,
                ...(LIVE_CONTEXT_COMPRESSION_TARGET
                  ? {
                      slidingWindow: {
                        targetTokens: LIVE_CONTEXT_COMPRESSION_TARGET,
                      },
                    }
                  : {}),
              },
            }
          : {}),
      };

      const session = await ai.live.connect({
        model: LIVE_MODEL,
        config: liveConfig,
        callbacks: {
          onmessage: (event) => {
            void handleServerMessage(event);
          },
          onerror: (event) => {
            const message = event.error?.message ?? "Live session error";
            setError(message);
            setStatus("error");
          },
          onclose: () => {
            sessionRef.current = null;
            void stopMicrophoneCapture();
            void closePlayback();
            setIsMicMuted(false);
            isMicMutedRef.current = false;

            if (statusRef.current !== "error") {
              setStatus("idle");
            }
          },
        },
      });

      sessionRef.current = session;
      setExpiresAt(new Date(expiresAtIso));
      setStatus("connected");
      setModeRef.current("idle");

      await startMicrophoneCapture(session);
    } catch (err) {
      await disconnectAgent();
      const message =
        err instanceof Error ? err.message : "Failed to connect to voice agent";
      setError(message);
      setStatus("error");
      setModeRef.current("idle");
    }
  }, [
    closePlayback,
    disconnectAgent,
    handleServerMessage,
    startMicrophoneCapture,
    stopMicrophoneCapture,
  ]);

  const toggleMic = useCallback(() => {
    if (!sessionRef.current || statusRef.current !== "connected") {
      return;
    }

    setIsMicMuted((prev) => {
      const next = !prev;
      isMicMutedRef.current = next;

      if (next) {
        sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true });
      }

      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      void disconnectAgent();
    };
  }, [disconnectAgent]);

  return {
    session: sessionRef.current,
    status,
    error,
    expiresAt,
    isMicrophoneReady,
    isMicMuted,
    connectAgent,
    disconnectAgent,
    toggleMic,
  };
};

export type UseVoiceAgentReturn = ReturnType<typeof useVoiceAgent>;
