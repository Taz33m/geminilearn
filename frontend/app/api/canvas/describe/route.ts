import { NextRequest, NextResponse } from 'next/server';
import { describeCanvas } from '@/lib/gemini/canvas-description';

export async function POST(request: NextRequest) {
  try {
    const { imageData, conversationContext } = await request.json();

    // Validate required imageData
    if (!imageData || typeof imageData !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid imageData' },
        { status: 400 }
      );
    }

    // Validate it's a data URL
    if (!imageData.startsWith('data:image/')) {
      return NextResponse.json(
        { success: false, error: 'Invalid image format' },
        { status: 400 }
      );
    }

    // conversationContext is optional, no validation needed
    const description = await describeCanvas(
      imageData,
      conversationContext || undefined
    );

    return NextResponse.json({
      success: true,
      description,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to describe canvas';

    console.error('[api] Canvas description error:', message);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
