import { NextResponse } from "next/server";
import { sanitizeDraft } from "@/lib/options";
import { buildPrompt, validatePrompt } from "@/lib/prompt";
import { enhanceImagePrompt, LM_STUDIO_PROMPT_MODEL } from "@/lib/lmstudio";
import { enhanceImagePromptWithOllama, OLLAMA_PROMPT_MODEL } from "@/lib/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const allowExplicit = process.env.ALLOW_EXPLICIT === "true";
  const body = await req.json() as Record<string, unknown>;
  const provider = body.provider === "ollama" ? "ollama" : "lmstudio";
  const draft = sanitizeDraft(body.draft ?? body, allowExplicit);
  const suppliedPrompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 6000) : "";
  const basePrompt = suppliedPrompt || buildPrompt(draft, { allowExplicit });
  const baseValidation = validatePrompt(basePrompt);

  if (!baseValidation.allowed) {
    return NextResponse.json(
      { error: baseValidation.reason, validation: baseValidation },
      { status: 422 }
    );
  }

  try {
    const result = provider === "ollama"
      ? await enhanceImagePromptWithOllama(basePrompt, typeof body.model === "string" ? body.model : undefined)
      : await enhanceImagePrompt(basePrompt, typeof body.model === "string" ? body.model : undefined);
    const validation = validatePrompt(result.prompt);
    if (!validation.allowed) {
      return NextResponse.json(
        {
          error: validation.reason ?? "The enhanced prompt failed the adult-content safety checks.",
          validation,
          candidate: result.prompt
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ ...result, provider, basePrompt, validation });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "LM Studio prompt enhancement failed.",
        model: provider === "ollama" ? OLLAMA_PROMPT_MODEL : LM_STUDIO_PROMPT_MODEL,
        provider
      },
      { status: 503 }
    );
  }
}
