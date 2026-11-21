import { comfyFetch } from "./comfyui";
import { readJobProgress } from "./comfy-progress";
import type { QueueJob, QueueJobState, QueueSnapshot } from "./dashboard-contract";

type JsonObject = Record<string, unknown>;
type RawQueue = {
  queue_running?: unknown[];
  queue_pending?: unknown[];
};

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function nodeByClass(workflow: JsonObject, classType: string): JsonObject | null {
  for (const value of Object.values(workflow)) {
    const node = asObject(value);
    if (node?.class_type === classType) return node;
  }
  return null;
}

function nodeInputs(node: JsonObject | null): JsonObject {
  return asObject(node?.inputs) ?? {};
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseJob(item: unknown, state: QueueJobState, position: number): QueueJob | null {
  if (!Array.isArray(item) || typeof item[1] !== "string") return null;

  const workflow = asObject(item[2]) ?? {};
  const metadata = asObject(item[3]) ?? {};
  const textInputs = nodeInputs(nodeByClass(workflow, "TextEncodeQwenImage21"));
  const latentInputs = nodeInputs(nodeByClass(workflow, "EmptyLatentImage"));
  const samplerInputs = nodeInputs(nodeByClass(workflow, "KSampler"));
  const prompt = typeof textInputs.prompt === "string" ? textInputs.prompt.trim() : "";
  const createTime = finiteNumber(metadata.create_time);
  const owned = Object.values(workflow).some((node) => {
    const n = asObject(node);
    return n?.class_type === "SaveImage" && String(nodeInputs(n).filename_prefix ?? "").startsWith("HOTPROMPTER");
  });
  const live = state === "running" && owned && typeof metadata.client_id === "string"
    ? readJobProgress(item[1], metadata.client_id) : null;
  const currentClass = live?.node ? asObject(workflow[live.node])?.class_type : null;
  const stage = currentClass === "KSampler" ? "Sampling"
    : currentClass === "VAEDecode" ? "Decoding image"
    : currentClass === "SaveImage" ? "Saving image"
    : currentClass === "TextEncodeQwenImage21" ? "Encoding prompt / loading text model"
    : currentClass ? "Preparing models and image inputs" : "Waiting for live progress";

  return {
    promptId: item[1],
    state,
    position,
    promptPreview: prompt ? prompt.slice(0, 220) : "Prompt details unavailable",
    width: finiteNumber(latentInputs.width),
    height: finiteNumber(latentInputs.height),
    seed: finiteNumber(samplerInputs.seed),
    samplingSteps: finiteNumber(samplerInputs.steps),
    progress: live ? { connected: live.connected, stage, value: currentClass === "KSampler" ? live.value : null, max: currentClass === "KSampler" ? live.max : null, updatedAt: live.updatedAt } : undefined,
    createdAt: createTime === null ? null : new Date(createTime).toISOString()
  };
}

export async function readComfyQueue(): Promise<QueueSnapshot> {
  const response = await comfyFetch("/queue", {}, 5_000);
  if (!response.ok) throw new Error(`ComfyUI queue returned ${response.status}.`);

  const data = await response.json() as RawQueue;
  const runningItems = Array.isArray(data.queue_running) ? data.queue_running : [];
  const pendingItems = Array.isArray(data.queue_pending) ? data.queue_pending : [];
  const jobs = [
    ...runningItems.map((item, index) => parseJob(item, "running", index + 1)),
    ...pendingItems.map((item, index) => parseJob(item, "pending", index + 1))
  ].filter((job): job is QueueJob => job !== null);

  return {
    running: runningItems.length,
    pending: pendingItems.length,
    total: runningItems.length + pendingItems.length,
    jobs
  };
}

export async function cancelComfyJob(promptId: string): Promise<boolean> {
  const response = await comfyFetch(
    `/api/jobs/${encodeURIComponent(promptId)}/cancel`,
    { method: "POST" },
    10_000
  );
  if (!response.ok) throw new Error(`ComfyUI cancel returned ${response.status}.`);
  const data = await response.json() as { cancelled?: boolean };
  return data.cancelled === true;
}
