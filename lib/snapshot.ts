import { createHash } from "node:crypto";
import { manualProvenance, type Provenance } from "./provenance";

function canonical(value:unknown):string{
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value && typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function deepFreeze<T>(value:T):T{
  if(value && typeof value==='object'&&!Object.isFrozen(value)){
    for(const child of Object.values(value))deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export type FrozenJob = {
  id: string;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  seed: number;
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string;
  denoise: number;
  models?: { unet: string; clip: string; clipLoader: "CLIPLoader" | "CLIPLoaderGGUF"; vae: string };
  provenance?: Provenance;
  draft?: Record<string,string>;
  createdAt: number;
  hash: string;
};

export function freezeJob(input: Omit<FrozenJob, "hash" | "createdAt">): FrozenJob {
  const sourceProvenance = input.provenance ?? { jobHash: "", ...manualProvenance(input.prompt) };
  const attribution = {
    presetStack: sourceProvenance.presetStack.map(item => ({ ...item })),
    presetContrib: { ...sourceProvenance.presetContrib },
    derivedFlags: [...sourceProvenance.derivedFlags],
    overrides: [...sourceProvenance.overrides],
    presetDefinitions: sourceProvenance.presetDefinitions ? JSON.parse(JSON.stringify(sourceProvenance.presetDefinitions)) as Provenance['presetDefinitions'] : []
  };
  const content = canonical({
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    width: input.width,
    height: input.height,
    seed: input.seed,
    steps: input.steps,
    cfg: input.cfg,
    sampler: input.sampler,
    scheduler: input.scheduler,
    denoise: input.denoise,
    ...(input.models ? { models: input.models } : {}),
    attribution,
    ...(input.draft ? {draft: input.draft} : {})
  });
  const hash = createHash("sha256").update(content).digest("hex");
  return Object.freeze({
    ...input,
    ...(input.draft ? {draft:Object.freeze({...input.draft})} : {}),
    ...(input.models ? { models: Object.freeze({ ...input.models }) } : {}),
    createdAt: Date.now(),
    hash,
    provenance: deepFreeze({
      jobHash: hash,
      presetStack: Object.freeze(attribution.presetStack.map(item => Object.freeze(item))) as unknown as Provenance["presetStack"],
      presetContrib: Object.freeze(attribution.presetContrib),
      derivedFlags: Object.freeze(attribution.derivedFlags) as unknown as string[],
      overrides: Object.freeze(attribution.overrides) as unknown as string[],
      presetDefinitions: attribution.presetDefinitions,
      marks: null
    })
  });
}

