import { assertLocalAiUrl } from "./local-ai-url";
import type { FrozenJob } from "./snapshot";
import { COMFY_MODELS } from "./comfy-config";
export { COMFY_MODELS } from "./comfy-config";

export type ComfyWorkflow = Record<
  string,
  {
    class_type: string;
    inputs: Record<string, unknown>;
    _meta?: { title: string };
  }
>;

export type ComfyImage = {
  filename: string;
  subfolder: string;
  type: "input" | "output" | "temp";
};

export const COMFYUI_URL = (process.env.COMFYUI_URL ?? "http://127.0.0.1:8188")
  .replace(/\/$/, "");

export async function comfyFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = 10_000
): Promise<Response> {
  assertLocalAiUrl(COMFYUI_URL, "ComfyUI");
  return fetch(`${COMFYUI_URL}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs)
  });
}

export const MIN_CFG_WITH_NEGATIVE = 2.5;

export function resolveCfg(negativePrompt: string, requested: number): number {
  if (!negativePrompt.trim()) return 1;
  if (requested >= MIN_CFG_WITH_NEGATIVE) return requested;
  return 3;
}

export function buildQwenWorkflow(job: FrozenJob): ComfyWorkflow {
  return {
    "1": {
      class_type: "UnetLoaderGGUF",
      inputs: { unet_name: job.models?.unet ?? COMFY_MODELS.unet },
      _meta: { title: "Load Qwen Image 2.1 GGUF" }
    },
    "2": {
      class_type: job.models?.clipLoader ?? "CLIPLoader",
      inputs: {
        clip_name: job.models?.clip ?? COMFY_MODELS.clip,
        type: "qwen_image",
        ...(job.models?.clipLoader === "CLIPLoaderGGUF" ? {} : { device: "cpu" })
      },
      _meta: { title: "Load Qwen 3 VL text encoder" }
    },
    "3": {
      class_type: "VAELoader",
      inputs: { vae_name: job.models?.vae ?? COMFY_MODELS.vae },
      _meta: { title: "Load Qwen Image 2.1 VAE" }
    },
    "4": {
      class_type: "TextEncodeQwenImage21",
      inputs: {
        clip: ["2", 0],
        prompt: job.prompt,
        negative_prompt: job.negativePrompt,
        resolution: Math.max(job.width, job.height)
      },
      _meta: { title: "HOTPROMPTER text" }
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: {
        width: job.width,
        height: job.height,
        batch_size: 1
      },
      _meta: { title: "Empty latent" }
    },
    "6": {
      class_type: "QwenImage21Cache",
      inputs: {
        model: ["1", 0],
        device: "off",
        dtype: "int8"
      },
      _meta: { title: "Minimize Qwen cache RAM" }
    },
    "7": {
      class_type: "KSampler",
      inputs: {
        model: ["6", 0],
        positive: ["4", 0],
        negative: ["4", 1],
        latent_image: ["5", 0],
        seed: job.seed,
        steps: job.steps,
        cfg: job.cfg,
        sampler_name: job.sampler,
        scheduler: job.scheduler,
        denoise: job.denoise
      },
      _meta: { title: "Sample image" }
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["7", 0], vae: ["3", 0] },
      _meta: { title: "Decode image" }
    },
    "9": {
      class_type: "SaveImage",
      inputs: {
        images: ["8", 0],
        filename_prefix: `HOTPROMPTER_${job.hash.slice(0, 8)}`
      },
      _meta: { title: "Return image to HOTPROMPTER" }
    }
  };
}

export function firstHistoryImage(historyEntry: unknown): ComfyImage | null {
  const outputs = (historyEntry as { outputs?: Record<string, unknown> } | null)?.outputs;
  if (!outputs) return null;

  for (const output of Object.values(outputs)) {
    const images = (output as { images?: unknown[] } | null)?.images;
    if (!Array.isArray(images)) continue;

    for (const image of images) {
      const candidate = image as Partial<ComfyImage>;
      if (
        typeof candidate.filename === "string" &&
        typeof candidate.subfolder === "string" &&
        (candidate.type === "input" || candidate.type === "output" || candidate.type === "temp")
      ) {
        return candidate as ComfyImage;
      }
    }
  }

  return null;
}

export function imageViewerUrl(image: ComfyImage): string {
  const params = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder,
    type: image.type
  });
  return `/api/comfyui-image?${params.toString()}`;
}
