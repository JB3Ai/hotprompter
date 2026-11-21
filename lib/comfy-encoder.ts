import { COMFY_MODELS, FALLBACK_ENCODER_FILE, Q4_ENCODER_FILE } from "./comfy-config";

export type ObjectInfo = Record<string, { input?: { required?: Record<string, unknown> } }>;
export type EncoderSelection = {
  filename: string;
  loader: "CLIPLoader" | "CLIPLoaderGGUF";
  warning: string | null;
};

export function comboValues(info: ObjectInfo, nodeName: string, inputName: string): string[] {
  const definition = info[nodeName]?.input?.required?.[inputName];
  if (!Array.isArray(definition)) return [];
  // ComfyUI advertises both legacy lists and newer COMBO option objects.
  const values = Array.isArray(definition[0]) ? definition[0]
    : (definition[1] as { options?: unknown[] } | undefined)?.options;
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : [];
}

export function selectEncoder(info: ObjectInfo, preferred = Q4_ENCODER_FILE || COMFY_MODELS.clip, fallback = FALLBACK_ENCODER_FILE): EncoderSelection {
  const loaderFor = (filename: string): EncoderSelection["loader"] =>
    filename.toLowerCase().endsWith(".gguf") ? "CLIPLoaderGGUF" : "CLIPLoader";
  const available = (filename: string) => comboValues(info, loaderFor(filename), "clip_name").includes(filename)
    && comboValues(info, loaderFor(filename), "type").includes("qwen_image");
  if (available(preferred)) return { filename: preferred, loader: loaderFor(preferred), warning: null };
  if (fallback !== preferred && available(fallback)) {
    return { filename: fallback, loader: loaderFor(fallback), warning: `Encoder ${preferred} is unavailable or its loader lacks qwen_image support; using ${fallback}.` };
  }
  throw new Error(`No usable Qwen Image encoder. Missing ${preferred}${fallback !== preferred ? ` and fallback ${fallback}` : ""}.`);
}

const logging = globalThis as typeof globalThis & { hotprompterEncoderWarning?: string };
export function warnEncoderFallback(selection: EncoderSelection): void {
  if (selection.warning && logging.hotprompterEncoderWarning !== selection.warning) {
    console.warn(`[HOTPROMPTER] ${selection.warning}`);
  }
  logging.hotprompterEncoderWarning = selection.warning ?? undefined;
}
