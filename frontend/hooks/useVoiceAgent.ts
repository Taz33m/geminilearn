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
import type { FunctionTool } from "@google/adk";

import { createAdkTools, runAdkTool } from "@/lib/adk-tools";
import { canvasEditorRef } from "@/components/canvas";
import { FlashcardSessionState, FlashcardActions } from "@/types/flashcard";
import {
  VisualizationState,
  VisualizationActions,
} from "@/types/visualization";
import { DeepDiveState, DeepDiveActions } from "@/types/deepdive";
import type { GoogleDocSection, GoogleSheetTab } from "@/types/session";

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
  output?: Record<string, unknown>;
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

// FunctionDeclarations are derived at runtime from ADK FunctionTool instances (see useVoiceAgent).

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

const buildAgentInstructions = (deckSummary: string) => `You are an encouraging and knowledgeable teaching assistant. Always respond in English. Be warm, clear, and concise while helping students learn.

CRITICAL RULE: You have tools. ALWAYS use the correct tool instead of describing content verbally. Never recite flashcard content, diagram content, or document content out loud — always call the appropriate tool and let the UI display it.

FLASHCARD MANAGEMENT:
- When the user asks for flashcards on any topic, you MUST call generate_flashcards immediately. Do not describe or recite flashcard content verbally.
- Do NOT proactively suggest flashcards unless the user asks.
- Call generate_flashcards with the topic (and focus if provided). The cards will appear on screen automatically.
- After the tool returns, say only how many cards were created and invite the user to start reviewing.
- If the tool fails, apologize briefly and ask whether they'd like to try again.

FLASHCARD NAVIGATION:
- Call get_current_flashcard_context to understand which card the user is viewing before discussing it.
- When the user asks to flip the card, show the answer, or reveal the answer, call flip_flashcard.
- When the user asks to go to the next card or move forward, call next_flashcard.
- When the user asks to go back or see the previous card, call previous_flashcard.

FLASHCARD GUIDANCE:
- After calling get_current_flashcard_context, use the response to guide the discussion.
- If the card is NOT flipped: discuss the topic, offer hints, and expand on concepts, but DO NOT reveal the exact answer text.
- If the card IS flipped: discuss the answer openly and compare the student's response to the correct answer.
- Always be encouraging and educational.

CANVAS AWARENESS:
- ONLY call get_canvas_snapshot when the user explicitly refers to what they drew or asks you to inspect the canvas.
- Examples: "What did I draw?", "Can you see what's on the canvas?", "Based on what I drew, what do you understand?"
- Do NOT call this tool proactively.
- Include conversationContext when helpful, such as: "We've been discussing mitosis and cell division."
- If the canvas is empty, clearly tell the user nothing is drawn yet.

VISUALIZATION GENERATION:
- When the user asks for an image, illustration, diagram, chart, flowchart, or visual aid, call generate_visualization.
- Pass a detailed imageDescription with subject, style, composition, labels, colors, and key details.
- Set includeCanvasImage=true ONLY when the user asks to enhance or build on their existing canvas drawing.
- After generating, tell the user the visualization is ready.
- When the user wants to return to flashcards, call show_flashcards.

DEEP DIVE GENERATION:
- When the user asks for a deep dive, comprehensive overview, or detailed explanation, call generate_deep_dive.
- Build the topic parameter with full context. If the user references the canvas, embed that context (example: "photosynthesis, focusing on the chloroplast structure the student drew").
- Include relevant conversation context in the topic so the output stays grounded.
- After generating, tell the user the deep dive is ready.
- When the user wants to return to flashcards, call show_flashcards.

DOCS AND SHEETS ARTIFACTS:
- When the user asks for a memo, notes, or document, call create_google_doc.
- When the user asks for a spreadsheet, table, tracker, or structured dataset, call create_google_sheet.
- After each artifact is generated, confirm it is ready in the corresponding tab.

ERROR HANDLING:
- If any tool fails, apologize briefly and ask whether they'd like to try again.
- If there are no flashcards loaded and the user tries to navigate cards, suggest generating a deck first.

${deckSummary}`;

export const useVoiceAgent = (
  flashcardSession: FlashcardSessionState,
  flashcardActions: FlashcardActions,
  _visualizationState: VisualizationState,
  visualizationActions: VisualizationActions,
  _deepDiveState: DeepDiveState,
  deepDiveActions: DeepDiveActions,
  setContentView: (view: 'flashcards' | 'visualization' | 'deepdive') => void,
  onSetGoogleDoc?: (title: string, summary: string, sections: GoogleDocSection[]) => void,
  onSetGoogleSheet?: (title: string, summary: string, sheets: GoogleSheetTab[]) => void,
  onToolEvent?: (event: VoiceToolEvent) => void,
) => {
  const sessionRef = useRef<Session | null>(null);
  const sessionResumptionHandleRef = useRef<string | undefined>(undefined);
  const handleServerMessageRef = useRef<(message: LiveServerMessage) => Promise<void>>(async () => {});

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

  // Build ADK FunctionTool instances; derive FunctionDeclarations and tool map from them.
  const adkTools = useMemo(
    () =>
      createAdkTools({
        flashcardActions,
        getFlashcardSession: () => flashcardSessionRef.current,
        visualizationActions,
        deepDiveActions,
        getCanvasEditor: () => canvasEditorRef.current,
        setContentView,
        onSetGoogleDoc,
        onSetGoogleSheet,
      }),
    [
      flashcardActions,
      visualizationActions,
      deepDiveActions,
      setContentView,
      onSetGoogleDoc,
      onSetGoogleSheet,
    ],
  );

  const adkToolMapRef = useRef<Map<string, FunctionTool>>(new Map());
  const adkFunctionDeclarationsRef = useRef<ReturnType<FunctionTool['_getDeclaration']>[]>([]);

  useEffect(() => {
    adkToolMapRef.current = new Map(adkTools.map((t) => [t.name, t]));
    adkFunctionDeclarationsRef.current = adkTools.map((t) => t._getDeclaration());
  }, [adkTools]);

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
    if (!session || functionCalls.length === 0) return;

    console.log("[useVoiceAgent] handleToolCalls", functionCalls.map((c) => c.name));

    const responses = await Promise.all(
      functionCalls.map(async (call) => {
        const toolName = call.name ?? "";
        const args =
          call.args && typeof call.args === "object"
            ? (call.args as Record<string, unknown>)
            : {};

        try {
          // Dispatch via ADK FunctionTool — Zod-validated, proper Schema declarations
          const output = await runAdkTool(adkToolMapRef.current, toolName, args);
          const success = typeof output.success === "boolean" ? output.success : true;
          const message = typeof output.message === "string" ? output.message : `${toolName} ${success ? "completed" : "failed"}`;

          onToolEvent?.({ id: call.id ?? `${toolName}-${Date.now()}`, toolName, args, success, message, output, timestamp: new Date() });
          return { id: call.id, name: toolName, response: { output } };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown tool error";
          onToolEvent?.({ id: call.id ?? `${toolName}-${Date.now()}`, toolName, args, success: false, message, timestamp: new Date() });
          return { id: call.id, name: toolName, response: { error: message } };
        }
      }),
    );

    session.sendToolResponse({ functionResponses: responses });
  }, [onToolEvent]);

  const handleServerMessage = useCallback(
    async (message: LiveServerMessage) => {
      // Log any message that contains a tool call or function call reference
      const msgKeys = Object.keys(message).filter((k) => message[k as keyof LiveServerMessage] !== undefined && message[k as keyof LiveServerMessage] !== null);
      if (msgKeys.some((k) => k.toLowerCase().includes("tool") || k.toLowerCase().includes("function"))) {
        console.log("[useVoiceAgent] message with tool/function key", { keys: msgKeys, message });
      }

      const content = message.serverContent;
      const resumptionUpdate = message.sessionResumptionUpdate;

      // Log all non-audio parts for debugging tool dispatch
      if (content?.modelTurn?.parts) {
        const nonAudio = content.modelTurn.parts.filter((p) => !p.inlineData?.mimeType?.startsWith("audio/"));
        if (nonAudio.length > 0) {
          console.log("[useVoiceAgent] modelTurn non-audio parts", nonAudio);
        }
      }

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

      // Collect function calls from both message.toolCall and modelTurn parts
      const toolCallFcs = message.toolCall?.functionCalls ?? [];
      const partFcs: FunctionCall[] = (content?.modelTurn?.parts ?? [])
        .filter((p) => p.functionCall != null)
        .map((p) => p.functionCall as FunctionCall);

      if (message.toolCall) {
        console.log("[useVoiceAgent] toolCall message received", {
          functionCalls: message.toolCall.functionCalls?.map((c) => ({ name: c.name, args: c.args })),
        });
      }
      if (partFcs.length > 0) {
        console.log("[useVoiceAgent] functionCall parts in modelTurn", partFcs.map((c) => ({ name: c.name, args: c.args })));
      }

      const functionCalls = [...toolCallFcs, ...partFcs];
      if (functionCalls.length > 0) {
        await handleToolCalls(functionCalls);
      }
    },
    [handleToolCalls, queueAudioForPlayback, stopPlaybackQueue],
  );

  // Keep the ref in sync so the Gemini session's onmessage always calls the latest version.
  useEffect(() => {
    handleServerMessageRef.current = handleServerMessage;
  }, [handleServerMessage]);

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

    // Always start fresh — don't carry over stale session context from a previous run.
    sessionResumptionHandleRef.current = undefined;

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
        tools: [{ functionDeclarations: adkFunctionDeclarationsRef.current }],
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
            void handleServerMessageRef.current(event);
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
