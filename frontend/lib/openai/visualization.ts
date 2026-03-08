const OPENAI_IMAGE_MODEL =
  process.env.OPENAI_IMAGE_MODEL ?? "dall-e-3";
const OPENAI_IMAGE_SIZE =
  process.env.OPENAI_IMAGE_SIZE ?? "1024x1024";

export interface GenerateVisualizationInput {
  imageDescription: string;
  canvasImageData?: string;
}

export interface GenerateVisualizationResult {
  imageData: string;
}

interface OpenAIImagePayload {
  b64_json?: string;
  url?: string;
}

interface OpenAIImageGenerationResponse {
  data?: OpenAIImagePayload[];
  error?: {
    message?: string;
  };
}

const getOpenAIKey = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return apiKey;
};

const fetchImageAsDataUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch generated image URL (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type") ?? "image/png";
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
};

export async function generateVisualization({
  imageDescription,
  canvasImageData,
}: GenerateVisualizationInput): Promise<GenerateVisualizationResult> {
  const apiKey = getOpenAIKey();

  const contextSuffix = canvasImageData
    ? "\n\nContext: The user has an existing canvas. Keep style and composition consistent with their current study work."
    : "";
  const prompt = `${imageDescription}${contextSuffix}`;

  const requestBody: Record<string, unknown> = {
    model: OPENAI_IMAGE_MODEL,
    prompt,
    size: OPENAI_IMAGE_SIZE,
    n: 1,
    response_format: "b64_json",
  };

  if (OPENAI_IMAGE_MODEL === "dall-e-3") {
    requestBody.quality = "standard";
    requestBody.style = "natural";
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const payload = (await response.json()) as OpenAIImageGenerationResponse;
  if (!response.ok) {
    const message =
      payload.error?.message ??
      `OpenAI image generation failed (${response.status})`;
    throw new Error(message);
  }

  const firstImage = payload.data?.[0];
  if (!firstImage) {
    throw new Error("OpenAI image generation returned no image");
  }

  if (firstImage.b64_json) {
    return {
      imageData: `data:image/png;base64,${firstImage.b64_json}`,
    };
  }

  if (firstImage.url) {
    return {
      imageData: await fetchImageAsDataUrl(firstImage.url),
    };
  }

  throw new Error("OpenAI image response missing b64_json and url");
}
