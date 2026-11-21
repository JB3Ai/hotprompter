import { NextResponse } from "next/server";
import { listOllamaModels, OLLAMA_PROMPT_MODEL } from "@/lib/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const models = await listOllamaModels();
    return NextResponse.json({ models, selected: OLLAMA_PROMPT_MODEL }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ models: [], selected: OLLAMA_PROMPT_MODEL, error: error instanceof Error ? error.message : "Ollama unavailable" }, { status: 503 });
  }
}
