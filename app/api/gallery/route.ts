import { NextResponse } from "next/server";
import { comfyFetch, type ComfyImage } from "@/lib/comfyui";
import path from "node:path";
import { stat, unlink } from "node:fs/promises";
import { readFrozenRecord, readMarks, readPresetRatings, validJobHash } from "@/lib/job-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HistoryEntry = {
  prompt?: unknown[];
  outputs?: Record<string, { images?: unknown[] } | undefined>;
  status?: { completed?: boolean; status_str?: string; messages?: unknown[] };
};

function safeName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length < 512 && value !== "." && value !== ".." && !/[\\/]/.test(value);
}

function safeSubfolder(value: unknown): value is string {
  return typeof value === "string" && !value.includes(":") && !value.startsWith("/") && value.split(/[\\/]/).every((p) => p !== "..");
}

function imageUrl(image: ComfyImage): string {
  const params = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder, type: image.type });
  return `/api/comfyui-image?${params.toString()}`;
}

const OUTPUT_ROOT = path.resolve(process.env.COMFYUI_OUTPUT_DIR ?? "D:\\ComfyUI_windows_portable\\ComfyUI\\output");

function outputPath(filename: unknown, subfolder: unknown): string | null {
  if (!safeName(filename) || !safeSubfolder(subfolder ?? "") || !/^HOTPROMPTER.*\.png$/i.test(filename)) return null;
  const target = path.resolve(OUTPUT_ROOT, String(subfolder ?? ""), filename);
  const relative = path.relative(OUTPUT_ROOT, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return target;
}

type JobMetadata = { promptPreview: string; negativePrompt: string; seed: number | null; steps: number | null; cfg: number | null; hash: string };

function jobMetadata(entry: HistoryEntry): JobMetadata {
  const empty = { promptPreview: "", negativePrompt: "", seed: null, steps: null, cfg: null, hash: "" };
  if (!Array.isArray(entry.prompt)) return empty;
  const workflow = entry.prompt[2];
  if (!workflow || typeof workflow !== "object") return empty;
  const result: JobMetadata = { ...empty };
  for (const node of Object.values(workflow as Record<string, unknown>)) {
    const n = node as { class_type?: string; inputs?: Record<string, unknown> } | null;
    if (n?.class_type === "TextEncodeQwenImage21" && typeof n.inputs?.prompt === "string") {
      result.promptPreview = n.inputs.prompt.replace(/\s+/g, " ").trim().slice(0, 220);
      result.negativePrompt = typeof n.inputs.negative_prompt === "string" ? n.inputs.negative_prompt : "";
    }
    if (n?.class_type === "KSampler") {
      const seed = Number(n.inputs?.seed);
      const steps = Number(n.inputs?.steps);
      const cfg = Number(n.inputs?.cfg);
      result.seed = Number.isFinite(seed) ? seed : null;
      result.steps = Number.isFinite(steps) ? steps : null;
      result.cfg = Number.isFinite(cfg) ? cfg : null;
    }
    if (n?.class_type === "SaveImage") {
      const prefix = typeof n.inputs?.filename_prefix === "string" ? n.inputs.filename_prefix : "";
      result.hash = /^HOTPROMPTER_([a-f0-9]{8})/i.exec(prefix)?.[1] ?? "";
    }
  }
  const extraData = entry.prompt[3] as { extra_pnginfo?: { hotprompter?: { hash?: unknown } } } | undefined;
  const fullHash = extraData?.extra_pnginfo?.hotprompter?.hash;
  if (typeof fullHash === "string" && /^[a-f0-9]{64}$/i.test(fullHash)) result.hash = fullHash;
  return result;
}

export async function GET(req: Request) {
  const limit = Math.min(60, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 24) || 24));
  try {
    const response = await comfyFetch("/history", {}, 15_000);
    if (!response.ok) throw new Error(`history ${response.status}`);
    const history = await response.json() as Record<string, HistoryEntry>;
    const items: Array<{ id: string; promptId: string; filename: string; promptPreview: string; negativePrompt: string; seed: number | null; steps: number | null; cfg: number | null; hash: string; url: string; downloadUrl: string; subfolder: string;marks:"keep"|"reject"|null;notes:string;hasProvenance:boolean;keepRate:number|null }> = [];
    const ratings=await readPresetRatings();
    const entries = Object.entries(history).reverse();
    for (const [promptId, entry] of entries) {
      if (entry.status?.completed !== true || entry.status?.status_str === "error") continue;
      const metadata = jobMetadata(entry);
      const frozen=validJobHash(metadata.hash)?await readFrozenRecord(metadata.hash):null;
      const marks=frozen?await readMarks(metadata.hash):{marks:null,notes:""};
      const eligible=frozen?.provenance?.presetStack.map(p=>ratings[p.id]?.rate).filter((rate):rate is number=>typeof rate==='number')??[];
      const outputs = entry?.outputs ?? {};
      for (const output of Object.values(outputs)) {
        const images = Array.isArray(output?.images) ? output.images : [];
        for (const img of images) {
          const c = img as Partial<ComfyImage>;
          if (!safeName(c.filename) || !safeSubfolder(c.subfolder ?? "")) continue;
          if (c.type !== "output") continue;
          if (!/^HOTPROMPTER.*\.png$/i.test(c.filename)) continue;
          const localPath = outputPath(c.filename, c.subfolder ?? "");
          if (!localPath) continue;
          try { await stat(localPath); } catch { continue; }
          const image: ComfyImage = { filename: c.filename, subfolder: String(c.subfolder ?? ""), type: c.type };
          items.push({
            id: `${promptId}:${image.filename}`,
            promptId,
            filename: image.filename,
            ...metadata,
            ...marks,
            hasProvenance:Boolean(frozen),
            keepRate:eligible.length?eligible.reduce((sum,value)=>sum+value,0)/eligible.length:null,
            url: imageUrl(image),
            downloadUrl: `${imageUrl(image)}&download=1`,
            subfolder: image.subfolder
          });
        }
      }
      if (items.length >= limit) break;
    }
    return NextResponse.json({ items: items.slice(0, limit), localOnly: true });
  } catch {
    return NextResponse.json({ error: "Local ComfyUI history is unavailable.", items: [] }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json() as { filename?: unknown; subfolder?: unknown };
    const target = outputPath(body.filename, body.subfolder ?? "");
    if (!target) return NextResponse.json({ error: "Invalid HOTPROMPTER output path." }, { status: 400 });
    await unlink(target);
    return NextResponse.json({ deleted: true, filename: body.filename });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === "ENOENT") return NextResponse.json({ error: "Image file was already removed." }, { status: 404 });
    return NextResponse.json({ error: "The local image could not be deleted." }, { status: 500 });
  }
}
