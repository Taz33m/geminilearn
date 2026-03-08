import { NextResponse } from "next/server";
import { z } from "zod";

import { generateGoogleDoc } from "@/lib/gemini/google-doc";

const requestSchema = z.object({
  topic: z.string().min(2, "Topic is required"),
  purpose: z.string().min(2).optional(),
  audience: z.string().min(2).optional(),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const result = await generateGoogleDoc(body);

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
          : "Failed to generate Google Doc artifact";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
