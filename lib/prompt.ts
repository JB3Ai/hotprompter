import { EXPLICIT_KEYS, type Draft } from "./options";

export type BuildOptions = { allowExplicit?: boolean };

export function buildPrompt(d: Draft, opts: BuildOptions = {}): string {
  const f: Draft = { ...d };
  if (!opts.allowExplicit) {
    for (const k of EXPLICIT_KEYS) f[k] = "";
  }

  const race = f.fantasyRace && f.fantasyRace !== "human" ? ` ${f.fantasyRace}` : "";
  const subject = f.age || f.persona || race
    ? `adult ${f.age ? `${f.age}-year-old` : ""}${race} ${f.persona ?? ""}`.replace(/\s+/g, " ").trim()
    : "";
  const parts = [
    f.user,
    subject,
    f.heritage && `${f.heritage} heritage`,
    f.body,
    f.hairColor && f.hairTexture && f.hairLength &&
      `${f.hairTexture} ${f.hairColor} ${f.hairLength} hair, ${f.hairStyle}`,
    f.eyeColor && `${f.eyeColor} eyes`,
    f.features,
    f.action,
    f.expression && `${f.expression} expression`,
    f.outfit,
    f.wearing,
    f.breastSize,
    f.buttSize,
    f.nudityLevel,
    f.intimacy && `${f.intimacy}, consensual`,
    f.adultAction && `${f.adultAction}, consensual adults`,
    f.additionalTheme && `${f.additionalTheme}, consensual adults`,
    f.relationshipDynamic,
    f.personality && `${f.personality} personality`,
    f.adultTheme,
    f.composition,
    f.scene,
    f.background,
    f.lighting,
    f.camera,
    f.cameraAngle,
    f.renderStyle,
    f.mood,
    "high detail, realistic skin texture, professional quality"
  ];
  return parts.filter(Boolean).join(", ").replace(/\s+/g, " ").trim();
}

export function buildNegativePrompt(): string {
  return [
    "minor, underage, child, teen, loli, shota, school setting,",
    "non-consensual, distressed, crying, forced,",
    "low quality, deformed, bad anatomy, extra limbs, extra fingers,",
    "blurry, watermark, text, signature, cropped, worst quality"
  ].join(" ");
}

const blockedPatterns: RegExp[] = [
  /\bminor\b/i, /\bunderage\b/i, /\bchild\b/i, /\bteen\b/i,
  /\bschool(?:girl|boy)?\b/i, /\byoung[- ]?looking\b/i,
  /\bloli\b/i, /\bshota\b/i, /\bkid\b/i, /\bbaby\b/i, /\btoddler\b/i,
  /\bnon[- ]?consensual\b/i, /\brape\b/i, /\bincest\b/i,
  /\breal person\b/i, /\bcelebrity\b/i, /\bbarely legal\b/i,
  /\bforced\b/i, /\bforcing\b/i, /\bunconscious\b/i, /\bdrugged\b/i,
  /\breluctant\b/i, /\bstruggling\b/i, /\bslave\b/i,
  /\bheld captive\b/i, /\bkidnapped\b/i,
  /\btied up\b/i, /\bgagged\b/i, /\bcrying\b/i, /\bscared\b/i, /\bafraid\b/i
];

export type ValidationResult = { allowed: boolean; reason: string | null };

export function validatePrompt(prompt: string): ValidationResult {
  const text = prompt.trim();
  if (!text) return { allowed: false, reason: "Select at least a persona, age, and style." };

  for (const p of blockedPatterns) {
    if (p.test(text)) return { allowed: false, reason: "This prompt contains disallowed content." };
  }

  if (!/\badult\b/i.test(text) || !/\b\d{2}-year-old\b/i.test(text)) {
    return { allowed: false, reason: "The subject must be a clearly described adult." };
  }

  return { allowed: true, reason: null };
}
