import { NextRequest, NextResponse } from 'next/server';
import { generateVisualization, GenerateVisualizationInput } from '@/lib/openai/visualization';
import { z } from 'zod';

const requestSchema = z.object({
  imageDescription: z.string().min(2, 'Description must be at least 2 characters').optional(),
  prompt: z.string().min(2, 'Prompt must be at least 2 characters').optional(),
  topic: z.string().min(2, 'Topic must be at least 2 characters').optional(),
  canvasImageData: z.string().optional(), // Optional base64 data URL - provided by tool if canvas was captured
}).refine(
  (value) => Boolean(value.imageDescription ?? value.prompt ?? value.topic),
  {
    message: 'Provide imageDescription, prompt, or topic.',
    path: ['imageDescription'],
  }
);

type RequestBody = z.infer<typeof requestSchema>;

export async function POST(request: NextRequest) {
  let body: RequestBody;

  try {
    const json = await request.json();
    console.log('[api] Received request:', {
      hasImageDescription: !!json.imageDescription,
      imageDescriptionLength: json.imageDescription?.length,
      hasPrompt: !!json.prompt,
      promptLength: json.prompt?.length,
      hasTopic: !!json.topic,
      topicLength: json.topic?.length,
      hasCanvasImageData: !!json.canvasImageData,
      canvasImageDataLength: json.canvasImageData?.length,
    });
    body = requestSchema.parse(json);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors.map((err) => err.message).join(', ')
        : 'Invalid request body';

    console.error('[api] Validation error:', {
      error: message,
      zodErrors: error instanceof z.ZodError ? error.errors : null,
      receivedData: error instanceof z.ZodError ? error.errors[0]?.path : null,
    });

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }

  try {
    const imageDescription =
      body.imageDescription?.trim() ||
      body.prompt?.trim() ||
      body.topic?.trim();

    if (!imageDescription) {
      return NextResponse.json(
        {
          success: false,
          error: 'Provide imageDescription, prompt, or topic.',
        },
        { status: 400 }
      );
    }

    const result = await generateVisualization({
      imageDescription,
      canvasImageData: body.canvasImageData,
    } as GenerateVisualizationInput);

    return NextResponse.json({
      success: true,
      imageData: result.imageData,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to generate visualization';

    console.error('[api] Visualization generation error:', message);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
