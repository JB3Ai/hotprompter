import { NextResponse } from "next/server";
import { listLmStudioModels, LM_STUDIO_PROMPT_MODEL } from "@/lib/lmstudio";
import { listOllamaModels, OLLAMA_PROMPT_MODEL } from "@/lib/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [lmStudioResult, ollamaResult] = await Promise.allSettled([
    listLmStudioModels(),
    listOllamaModels()
  ]);
  return NextResponse.json({
    lmstudio: {
      models: lmStudioResult.status === "fulfilled" ? lmStudioResult.value : [],
      selected: LM_STUDIO_PROMPT_MODEL,
      error: lmStudioResult.status === "rejected" ? "LM Studio model list unavailable" : null
    },
    ollama: {
      models: ollamaResult.status === "fulfilled" ? ollamaResult.value : [],
      selected: OLLAMA_PROMPT_MODEL,
      error: ollamaResult.status === "rejected" ? "Ollama model list unavailable" : null
    }
  }, { headers: { "Cache-Control": "no-store" } });
}
