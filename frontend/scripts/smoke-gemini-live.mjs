import { GoogleGenAI, Modality } from "@google/genai";

const TOKEN_ENDPOINT =
  process.env.GEMINILEARN_TOKEN_ENDPOINT ??
  "http://127.0.0.1:3000/api/voice/token";

const LIVE_MODEL =
  process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL ??
  "gemini-2.5-flash-native-audio-preview-12-2025";

const CONNECT_WAIT_MS = 1200;
const CLOSE_TIMEOUT_MS = 8000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const fetchEphemeralToken = async () => {
  let response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch {
    throw new Error(
      `Unable to reach ${TOKEN_ENDPOINT}. Start the app with 'npm run dev' first.`,
    );
  }

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(
      `Token request failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }

  const token = payload?.ephemeralKey;
  if (!token || typeof token !== "string") {
    throw new Error("Token response missing ephemeralKey.");
  }

  return token;
};

const main = async () => {
  console.log(`[smoke] Requesting token from ${TOKEN_ENDPOINT}`);
  const token = await fetchEphemeralToken();
  console.log("[smoke] Token request succeeded");

  const ai = new GoogleGenAI({
    apiKey: token,
    apiVersion: "v1alpha",
  });

  let closeResolve = null;
  const closePromise = new Promise((resolve) => {
    closeResolve = resolve;
  });
  let liveError = null;

  const session = await ai.live.connect({
    model: LIVE_MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
    },
    callbacks: {
      onmessage: () => {},
      onerror: (event) => {
        liveError = event.error?.message ?? "Unknown live session error.";
      },
      onclose: () => {
        if (closeResolve) {
          closeResolve();
        }
      },
    },
  });

  console.log(`[smoke] Live connect succeeded (${LIVE_MODEL})`);
  await sleep(CONNECT_WAIT_MS);

  if (liveError) {
    throw new Error(`[smoke] Live error after connect: ${liveError}`);
  }

  session.close();
  await Promise.race([
    closePromise,
    sleep(CLOSE_TIMEOUT_MS).then(() => {
      throw new Error("[smoke] Session close timeout.");
    }),
  ]);

  console.log("[smoke] Live close succeeded");
  console.log("[smoke] Gemini Live voice pipeline smoke test passed");
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[smoke] FAILED: ${message}`);
  process.exitCode = 1;
});
