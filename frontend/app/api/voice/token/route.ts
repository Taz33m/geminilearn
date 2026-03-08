import { GoogleGenAI, Modality } from "@google/genai";
import { NextResponse } from "next/server";

const LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL ??
  process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL ??
  "gemini-2.5-flash-native-audio-preview-12-2025";

export async function POST(): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GEMINI_API_KEY environment variable" },
      { status: 500 },
    );
  }

  try {
    const now = Date.now();
    const expiresAt = new Date(now + 30 * 60 * 1000).toISOString();
    const newSessionExpiresAt = new Date(now + 60 * 1000).toISOString();

    const ai = new GoogleGenAI({
      apiKey,
      apiVersion: "v1alpha",
    });

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: expiresAt,
        newSessionExpireTime: newSessionExpiresAt,
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            sessionResumption: {},
          },
        },
      },
    });

    if (!token.name) {
      throw new Error("Token API did not return a token name");
    }

    return NextResponse.json(
      {
        ephemeralKey: token.name,
        expiresAt,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Failed to generate Gemini ephemeral key", error);
    return NextResponse.json(
      { error: "Failed to generate Gemini ephemeral key" },
      { status: 500 },
    );
  }
}
