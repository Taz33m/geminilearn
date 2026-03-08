import { NextRequest, NextResponse } from 'next/server';
import { generateVisualization, GenerateVisualizationInput } from '@/lib/gemini/visualization';
import { z } from 'zod';

const requestSchema = z.object({
  imageDescription: z.string().min(10, 'Description must be at least 10 characters'),
  canvasImageData: z.string().optional(), // Optional base64 data URL - provided by tool if canvas was captured
});

type RequestBody = z.infer<typeof requestSchema>;

export async function POST(request: NextRequest) {
  let body: RequestBody;

  try {
    const json = await request.json();
    console.log('[api] Received request:', {
      hasImageDescription: !!json.imageDescription,
      imageDescriptionLength: json.imageDescription?.length,
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
    const result = await generateVisualization({
      imageDescription: body.imageDescription,
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
