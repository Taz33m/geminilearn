import { NextResponse } from "next/server";
import { z } from "zod";

import { generateGoogleSheet } from "@/lib/gemini/google-sheet";

const requestSchema = z.object({
  topic: z.string().min(2, "Topic is required"),
  objective: z.string().min(2).optional(),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const result = await generateGoogleSheet(body);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors.map((entry) => entry.message).join(", ")
        : error instanceof Error
          ? error.message
          : "Failed to generate Google Sheet artifact";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
