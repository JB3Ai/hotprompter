import { assertLocalAiUrl } from "./local-ai-url";
import { IMAGE_PROMPT_ENHANCER_PERSONA } from "./enhancer-persona";

export const LM_STUDIO_URL = (
  process.env.LM_STUDIO_URL ??
  process.env.OLLAMA_URL ??
  "http://127.0.0.1:1234"
).replace(/\/$/, "");

export const LM_STUDIO_PROMPT_MODEL =
  process.env.LM_STUDIO_PROMPT_MODEL ??
  "qwen3.5-4b-uncensored-hauhaucs-aggressive";

type ChatOutput = { type?: string; content?: string };
type ChatResponse = {
  model_instance_id?: string;
  output?: ChatOutput[];
  stats?: {
    input_tokens?: number;
    total_output_tokens?: number;
    reasoning_output_tokens?: number;
    tokens_per_second?: number;
    time_to_first_token_seconds?: number;
  };
};

export async function lmStudioFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = 180_000
): Promise<Response> {
  assertLocalAiUrl(LM_STUDIO_URL, "LM Studio");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${LM_STUDIO_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function listLmStudioModels(): Promise<string[]> {
  const response = await lmStudioFetch("/v1/models", {}, 8_000);
  if (!response.ok) throw new Error(`LM Studio model list failed (${response.status}).`);
  const data = await response.json() as { data?: Array<{ id?: string }> };
  return (data.data ?? []).map((model) => model.id).filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function enhanceImagePrompt(prompt: string, requestedModel?: string) {
  const model = requestedModel?.trim() || LM_STUDIO_PROMPT_MODEL;
  const models = await listLmStudioModels();
  if (!models.includes(model)) throw new Error(`LM Studio model is not available: ${model}`);
  const response = await lmStudioFetch("/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      system_prompt: IMAGE_PROMPT_ENHANCER_PERSONA,
      input: prompt,
      reasoning: "off",
      temperature: 0.45,
      max_output_tokens: 180,
      stream: false,
      store: false
    })
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`LM Studio rejected the request (${response.status}): ${detail}`);
  }

  const data = await response.json() as ChatResponse;
  const enhanced = data.output
    ?.filter((item) => item.type === "message" && typeof item.content === "string")
    .map((item) => item.content?.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!enhanced) throw new Error("LM Studio returned no finished prompt.");

  return {
    prompt: enhanced,
    model: data.model_instance_id ?? model,
    stats: data.stats ?? null
  };
}
