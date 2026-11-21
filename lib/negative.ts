export type NegativeGroups = {
  qualityFloor: boolean;
  anatomy: boolean;
  text: boolean;
  artifacts: boolean;
};

export type GenerationPresetId = "draft" | "balanced" | "final";

export const GENERATION_PRESETS: Record<GenerationPresetId, {
  label: string;
  steps: number;
  cfg: number;
  groups: NegativeGroups;
}> = {
  draft: {
    label: "Draft",
    steps: 12,
    cfg: 1,
    groups: { qualityFloor: false, anatomy: false, text: false, artifacts: false },
  },
  balanced: {
    label: "Balanced",
    steps: 20,
    cfg: 2.5,
    groups: { qualityFloor: true, anatomy: false, text: false, artifacts: false },
  },
  final: {
    label: "Final",
    steps: 30,
    cfg: 3.5,
    groups: { qualityFloor: true, anatomy: true, text: true, artifacts: true },
  }
};

const CN_FLOOR =
  "低分辨率，低画质，肢体畸形，手指畸形，画面过饱和，蜡像感，人脸无细节，过度光滑，画面具有 AI 感，构图混乱，文字模糊，扭曲";
const CN_ANATOMY = "多余的手指，缺失的手指，融合的肢体，多余的手臂，多余的小腿";
const CN_TEXT = "水印，签名，字幕，文字，logo";
const CN_ARTIFACTS = "jpeg 压缩伪影，噪点，色带，过度锐化，重影";
const MAX_NEGATIVE_TOKENS = 70;

function normalizeTerm(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function dedupeAgainstPositive(terms: string[], positive: string): string[] {
  const normalizedPositive = normalizeTerm(positive);
  return terms.filter((term) => {
    const key = normalizeTerm(term);
    return Boolean(key) && !(` ${normalizedPositive} `).includes(` ${key} `);
  });
}

export function buildNegativePrompt(groups: NegativeGroups, positive: string, extra: string[] = []): string {
  const parts: string[] = [];
  if (groups.qualityFloor) parts.push(CN_FLOOR);
  if (groups.anatomy) parts.push(CN_ANATOMY);
  if (groups.text) parts.push(CN_TEXT);
  if (groups.artifacts) parts.push(CN_ARTIFACTS);

  const terms = parts.flatMap((part) => part.split("，")).concat(extra);
  const seen = new Set<string>();
  const output: string[] = [];
  let estimatedTokens = 0;

  for (const term of dedupeAgainstPositive(terms, positive)) {
    const clean = term.trim();
    const key = normalizeTerm(clean);
    if (!key || seen.has(key)) continue;
    const cost = Math.max(1, Math.ceil(key.length / 3));
    if (estimatedTokens + cost > MAX_NEGATIVE_TOKENS) break;
    seen.add(key);
    output.push(clean);
    estimatedTokens += cost;
  }

  return output.join("，");
}

export function validateNegativePrompt(raw: string): { ok: boolean; value: string; notes: string[] } {
  const notes: string[] = [];
  let value = raw.replace(/\s+/g, " ").replace(/[，,]\s*[，,]/g, "，").trim();
  let terms = value.split(/[，,]/).map((term) => term.trim()).filter(Boolean);
  if (terms.length > 40) {
    terms = terms.slice(0, 40);
    notes.push("Negative truncated to 40 terms.");
  }
  value = terms.join("，");
  const stripped = value.replace(/(^|，)\s*(no|not|without|没有|无)\s+/gi, "$1");
  if (stripped !== value) notes.push("Removed no/not prefixes.");
  value = stripped;
  return { ok: value.length <= 900, value, notes };
}

