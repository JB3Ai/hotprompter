import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sanitizeDraft } from "@/lib/options";
import { buildPrompt, validatePrompt } from "@/lib/prompt";
import { validateNegativePrompt } from "@/lib/negative";
import { freezeJob } from "@/lib/snapshot";
import { comboValues, selectEncoder, warnEncoderFallback, type ObjectInfo } from "@/lib/comfy-encoder";
import { MAX_IMAGE_DIMENSION } from "@/lib/comfy-config";
import { saveFrozenRecord } from "@/lib/job-records";
import { captureProvenance } from "@/lib/provenance-server";
import {
  COMFY_MODELS,
  buildQwenWorkflow,
  comfyFetch,
  firstHistoryImage,
  imageViewerUrl,
  resolveCfg
} from "@/lib/comfyui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeDimension(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 512;
  return Math.round(Math.min(MAX_IMAGE_DIMENSION, Math.max(256, numeric)) / 16) * 16;
}

function newSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

function normalizeSeed(value: unknown): number {
  if (value === "" || value === null || value === undefined) return newSeed();
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return newSeed();
  return Math.min(0xffff_ffff, Math.max(0, Math.floor(numeric)));
}

function normalizeSteps(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(50, Math.max(8, Math.round(numeric))) : 12;
}

function normalizeCfg(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(6, Math.max(1, Math.round(numeric * 10) / 10)) : 1;
}

function safePromptId(value: string | null): string | null {
  if (!value || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) return null;
  return value;
}

async function queueState(promptId: string): Promise<"queued" | "running"> {
  try {
    const response = await comfyFetch("/queue");
    if (!response.ok) return "queued";
    const queue = await response.json() as {
      queue_running?: unknown[][];
      queue_pending?: unknown[][];
    };
    const containsPrompt = (items: unknown[][] | undefined) =>
      items?.some((item) => item.some((value) => value === promptId)) ?? false;
    return containsPrompt(queue.queue_running) ? "running" : "queued";
  } catch {
    return "queued";
  }
}

export async function GET(req: Request) {
  const promptId = safePromptId(new URL(req.url).searchParams.get("promptId"));

  if (!promptId) {
    try {
      const [systemResponse, objectResponse] = await Promise.all([
        comfyFetch("/system_stats", {}, 4_000),
        comfyFetch("/object_info", {}, 8_000)
      ]);
      if (!systemResponse.ok || !objectResponse.ok) throw new Error("ComfyUI unavailable");

      const info = await objectResponse.json() as ObjectInfo;
      const unets = comboValues(info, "UnetLoaderGGUF", "unet_name");
      const vaes = comboValues(info, "VAELoader", "vae_name");
      const missing: string[] = [];
      let encoder = null;
      try { encoder = selectEncoder(info); warnEncoderFallback(encoder); }
      catch (error) { missing.push(error instanceof Error ? error.message : "Qwen Image encoder"); }

      if (!info.UnetLoaderGGUF) missing.push("ComfyUI-GGUF custom node");
      if (!unets.includes(COMFY_MODELS.unet)) missing.push(COMFY_MODELS.unet);
      if (!info.TextEncodeQwenImage21) missing.push("Qwen Image 2.1 conditioning node");
      if (!info.QwenImage21Cache) missing.push("Qwen Image 2.1 cache node");
      if (!vaes.includes(COMFY_MODELS.vae)) missing.push(COMFY_MODELS.vae);

      return NextResponse.json({
        connected: true,
        ready: missing.length === 0,
        missing,
        encoder,
        maxImageDimension: MAX_IMAGE_DIMENSION,
        workflow: "Qwen Image 2.1 GGUF · CPU/RAM"
      });
    } catch {
      return NextResponse.json({
        connected: false,
        ready: false,
        missing: [],
        workflow: "Qwen Image 2.1 GGUF · CPU/RAM"
      });
    }
  }

  try {
    const response = await comfyFetch(`/history/${encodeURIComponent(promptId)}`);
    if (!response.ok) throw new Error("History unavailable");
    const history = await response.json() as Record<string, unknown>;
    const entry = history[promptId] as {
      status?: { completed?: boolean; status_str?: string };
    } | undefined;

    if (!entry) {
      return NextResponse.json(
        { status: await queueState(promptId), promptId },
        { status: 202 }
      );
    }

    const image = firstHistoryImage(entry);
    if (image) {
      return NextResponse.json({
        status: "complete",
        promptId,
        image: {
          url: imageViewerUrl(image),
          filename: image.filename
        }
      });
    }

    if (entry.status?.status_str === "error" || entry.status?.completed === false) {
      return NextResponse.json(
        { error: "ComfyUI could not complete this image. Check its terminal for the node error." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { status: "running", promptId },
      { status: 202 }
    );
  } catch {
    return NextResponse.json(
      { error: "HOTPROMPTER lost contact with ComfyUI. The queued job was not replayed." },
      { status: 503 }
    );
  }
}

export async function POST(req: Request) {
  const allowExplicit = process.env.ALLOW_EXPLICIT === "true";
  const body = await req.json() as Record<string, unknown>;
  const draft = sanitizeDraft(body.draft ?? body, allowExplicit);
  const suppliedPrompt = typeof body.prompt === "string"
    ? body.prompt.replace(/\s+/g, " ").trim().slice(0, 6_000)
    : "";
  const prompt = suppliedPrompt || buildPrompt(draft, { allowExplicit });
  const validation = validatePrompt(prompt);

  if (!validation.allowed) {
    return NextResponse.json({ error: validation.reason }, { status: 422 });
  }

  const negativeValidation = validateNegativePrompt(
    typeof body.negativePrompt === "string" ? body.negativePrompt : ""
  );
  if (!negativeValidation.ok) {
    return NextResponse.json({ error: "The negative prompt is too long." }, { status: 422 });
  }

  const width = normalizeDimension(body.width);
  const height = normalizeDimension(body.height);
  const seed = normalizeSeed(body.seed);
  const steps = normalizeSteps(body.steps);
  const requestedCfg = normalizeCfg(body.cfg);
  const cfg = resolveCfg(negativeValidation.value, requestedCfg);
  const clientId = randomUUID();
  let provenance;
  try { provenance = await captureProvenance(prompt, body.presetStack ?? [], sanitizeDraft(body.manualDraft ?? {}, allowExplicit)); }
  catch(error){return NextResponse.json({error:error instanceof Error ? error.message : "Invalid preset provenance."},{status:422});}
  let encoder;
  try {
    const infoResponse = await comfyFetch("/object_info", {}, 8_000);
    if (!infoResponse.ok) throw new Error("ComfyUI model inventory is unavailable.");
    encoder = selectEncoder(await infoResponse.json() as ObjectInfo);
    warnEncoderFallback(encoder);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ComfyUI encoder is unavailable." }, { status: 503 });
  }
  const snapshot = freezeJob({
    id: randomUUID(),
    prompt,
    negativePrompt: negativeValidation.value,
    width,
    height,
    seed,
    steps,
    cfg,
    sampler: "euler",
    scheduler: "simple",
    denoise: 1,
    models: { unet: COMFY_MODELS.unet, clip: encoder.filename, clipLoader: encoder.loader, vae: COMFY_MODELS.vae },
    provenance,
    draft
  });
  const workflow = buildQwenWorkflow(snapshot);

  try {
    // Persist before submission so ambiguous network failures retain the record.
    await saveFrozenRecord(snapshot);
    const response = await comfyFetch("/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: workflow,
        client_id: clientId,
        extra_data: { extra_pnginfo: { hotprompter: snapshot } }
      })
    }, 20_000);

    const data = await response.json() as {
      prompt_id?: string;
      node_errors?: Record<string, unknown>;
    };
    if (!response.ok || !data.prompt_id) {
      const nodes = Object.keys(data.node_errors ?? {});
      const detail = nodes.length > 0 ? ` Invalid workflow nodes: ${nodes.join(", ")}.` : "";
      return NextResponse.json(
        { error: `ComfyUI rejected the image workflow.${detail}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      status: "queued",
      promptId: data.prompt_id,
      ...snapshot,
      encoderWarning: encoder.warning,
      negativeNotes: negativeValidation.notes
    }, { status: 202 });
  } catch {
    return NextResponse.json(
      { error: "Could not reach ComfyUI at 127.0.0.1:8188. Start its CPU launcher first." },
      { status: 503 }
    );
  }
}
