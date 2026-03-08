import { NextRequest, NextResponse } from 'next/server';
import { generateDeepDive, GenerateDeepDiveInput } from '@/lib/gemini/deepdive';
import { z } from 'zod';

const requestSchema = z.object({
  topic: z.string().min(2, 'Topic must be at least 2 characters'),
});

type RequestBody = z.infer<typeof requestSchema>;

export async function POST(request: NextRequest) {
  let body: RequestBody;

  try {
    const json = await request.json();
    console.log('[api] Received deep dive request:', {
      hasTopic: !!json.topic,
      topicLength: json.topic?.length,
      topicPreview: json.topic?.substring(0, 100),
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
    const result = await generateDeepDive({
      topic: body.topic,
    } as GenerateDeepDiveInput);

    console.log('[api] Deep dive generation success:', {
      imageDataLength: result.imageData.length,
      overviewTextLength: result.overviewText.length,
    });

    return NextResponse.json({
      success: true,
      imageData: result.imageData,
      overviewText: result.overviewText,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to generate deep dive';

    console.error('[api] Deep dive generation error:', message);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
