import { NextResponse } from "next/server";
import { readComfyQueue } from "@/lib/comfy-queue";
import type {
  DashboardStatusResponse,
  LocalServiceStatus,
  QueueSnapshot
} from "@/lib/dashboard-contract";
import {
  LM_STUDIO_PROMPT_MODEL,
  lmStudioFetch
} from "@/lib/lmstudio";
import { listOllamaModels } from "@/lib/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY_QUEUE: QueueSnapshot = { running: 0, pending: 0, total: 0, jobs: [] };

async function lmStudioStatus(): Promise<LocalServiceStatus> {
  try {
    const response = await lmStudioFetch("/v1/models", {}, 4_000);
    if (!response.ok) throw new Error("LM Studio unavailable");
    const data = await response.json() as { data?: Array<{ id?: string }> };
    const available = data.data?.some((model) => model.id === LM_STUDIO_PROMPT_MODEL) ?? false;
    return {
      id: "lmstudio",
      label: "LM Studio",
      state: available ? "online" : "degraded",
      detail: available ? LM_STUDIO_PROMPT_MODEL : "Server online; selected model not listed"
    };
  } catch {
    return { id: "lmstudio", label: "LM Studio", state: "offline", detail: "Unavailable" };
  }
}

async function ollamaStatus(): Promise<LocalServiceStatus> {
  const model = process.env.OLLAMA_PROMPT_MODEL?.trim();
  if (!model) {
    return {
      id: "ollama",
      label: "Ollama",
      state: "not-configured",
      detail: "Future prompt provider"
    };
  }

  try {
    const models = await listOllamaModels();
    const available = models.some((candidate) =>
      candidate.name === model || candidate.model === model
    );
    return {
      id: "ollama",
      label: "Ollama",
      state: available ? "online" : "degraded",
      detail: available ? model : "Server online; selected model not listed"
    };
  } catch {
    return { id: "ollama", label: "Ollama", state: "offline", detail: "Unavailable" };
  }
}

export async function GET() {
  const [lmStudio, ollama, comfyResult] = await Promise.all([
    lmStudioStatus(),
    ollamaStatus(),
    readComfyQueue()
      .then((queue) => ({
        queue,
        status: {
          id: "comfyui",
          label: "ComfyUI",
          state: "online",
          detail: queue.running > 0 ? "Generating locally" : "Ready"
        } satisfies LocalServiceStatus
      }))
      .catch(() => ({
        queue: EMPTY_QUEUE,
        status: {
          id: "comfyui",
          label: "ComfyUI",
          state: "offline",
          detail: "Unavailable"
        } satisfies LocalServiceStatus
      }))
  ]);

  const payload: DashboardStatusResponse = {
    localOnly: true,
    generatedAt: new Date().toISOString(),
    services: [
      { id: "hotprompter", label: "HOTPROMPTER", state: "online", detail: "Local dashboard" },
      lmStudio,
      ollama,
      comfyResult.status
    ],
    queue: comfyResult.queue
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" }
  });
}
