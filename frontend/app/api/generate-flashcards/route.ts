import { NextResponse } from "next/server";
import { z } from "zod";

import {
  generateFlashcards,
  GenerateFlashcardsInput,
} from "@/lib/gemini/flashcards";

const requestSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  focus: z.string().optional(),
  lectureContext: z.string().optional(),
});

type RequestBody = z.infer<typeof requestSchema>;

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    const json = await request.json();
    body = requestSchema.parse(json);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors.map((err) => err.message).join(", ")
        : "Invalid request body";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }

  try {
    const result = await generateFlashcards(
      body as GenerateFlashcardsInput
    );

    return NextResponse.json({
      success: true,
      flashcards: result.flashcards,
      count: result.flashcards.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate flashcards";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
