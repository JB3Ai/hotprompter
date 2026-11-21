import { NextResponse } from "next/server";
import { sanitizeDraft } from "@/lib/options";
import { buildPrompt, buildNegativePrompt, validatePrompt } from "@/lib/prompt";

export async function POST(req: Request) {
  const allowExplicit = process.env.ALLOW_EXPLICIT === "true";
  const body = await req.json() as Record<string, unknown>;
  const draft = sanitizeDraft(body.draft ?? body, allowExplicit);

  const suppliedPrompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 6000) : "";
  const prompt = suppliedPrompt || buildPrompt(draft, { allowExplicit });
  const validation = validatePrompt(prompt);

  return NextResponse.json(
    { prompt, negativePrompt: buildNegativePrompt(), validation },
    { status: validation.allowed ? 200 : 422 }
  );
}
