import { assertLocalAiUrl } from "./local-ai-url";
import { IMAGE_PROMPT_ENHANCER_PERSONA } from "./enhancer-persona";

export const OLLAMA_URL = (process.env.OLLAMA_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
export const OLLAMA_PROMPT_MODEL = process.env.OLLAMA_PROMPT_MODEL?.trim() || "goonsai/qwen2.5-1.5B-goonsai-nsfw-10k:latest";

export type OllamaModel = {
  name: string;
  model: string;
  size: number;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
};

type ModelCache = { expiresAt: number; models: OllamaModel[]; pending?: Promise<OllamaModel[]> };
const shared = globalThis as typeof globalThis & { hotprompterOllamaModels?: ModelCache };
const modelCache = shared.hotprompterOllamaModels ??= { expiresAt: 0, models: [] };

export async function ollamaFetch(path: string, init: RequestInit = {}, timeoutMs = 180_000): Promise<Response> {
  assertLocalAiUrl(OLLAMA_URL, "Ollama");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${OLLAMA_URL}${path}`, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function listOllamaModels(): Promise<OllamaModel[]> {
  if (modelCache.expiresAt > Date.now()) return modelCache.models;
  if (modelCache.pending) return modelCache.pending;
  modelCache.pending = (async () => {
    const response = await ollamaFetch("/api/tags", {}, 8_000);
    if (!response.ok) throw new Error(`Ollama model list failed (${response.status}).`);
    const data = await response.json() as { models?: OllamaModel[] };
    const models = (data.models ?? []).filter((model) => typeof model.name === "string" && model.name.length > 0);
    modelCache.models = models;
    modelCache.expiresAt = Date.now() + 60_000;
    return models;
  })();
  try { return await modelCache.pending; }
  finally { modelCache.pending = undefined; }
}

export async function enhanceImagePromptWithOllama(prompt: string, requestedModel?: string) {
  const models = await listOllamaModels();
  const model = requestedModel?.trim() || OLLAMA_PROMPT_MODEL;
  if (!models.some((candidate) => candidate.name === model || candidate.model === model)) {
    throw new Error(`Ollama model is not installed: ${model}`);
  }

  const response = await ollamaFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: IMAGE_PROMPT_ENHANCER_PERSONA },
        { role: "user", content: `SOURCE PROMPT:\n${prompt}` }
      ],
      stream: false,
      think: false,
      keep_alive: "10m",
      options: { temperature: 0.3, num_predict: 140, repeat_penalty: 1.05 }
    })
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Ollama rejected the request (${response.status}): ${detail}`);
  }

  const data = await response.json() as {
    model?: string;
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
    total_duration?: number;
  };
  const normalized = data.message?.content
    ?.trim()
    .replace(/^[\s,;:.-]+/, "")
    .replace(/\bhair tied up\b/gi, "hair styled up");
  let generated = normalized
    ?.split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/\bshould not\b/i.test(sentence) && !/^do not\b/i.test(sentence))
    .join(" ")
    .trim();
  if (generated && /[.!?]/.test(generated) && !/[.!?]$/.test(generated)) {
    generated = generated.replace(/\s+[^.!?]*$/, "");
  }
  if (!generated) throw new Error("Ollama returned no finished prompt.");
  const enhanced = generated.toLocaleLowerCase().includes(prompt.toLocaleLowerCase())
    ? generated
    : `${prompt}, ${generated}`;

  return {
    prompt: enhanced,
    model: data.model ?? model,
    stats: {
      input_tokens: data.prompt_eval_count,
      total_output_tokens: data.eval_count,
      total_duration_ns: data.total_duration
    }
  };
}
