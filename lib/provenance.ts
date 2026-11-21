export type PresetKind = "subject" | "scene" | "camera" | "complete";
export type Provenance = {
  jobHash: string;
  presetStack: Array<{ id: string; kind: PresetKind; version: number; name?:string }>;
  presetContrib: Record<string, string>;
  derivedFlags: string[];
  overrides: string[];
  marks: "keep" | "reject" | null;
  notes?: string;
  presetDefinitions?: import("./preset-library").LibraryPreset[];
};

export function promptFragments(prompt: string): string[] {
  return [...new Set(prompt.split(/[,，\n]+/).map(value => value.trim()).filter(Boolean))];
}

export function manualProvenance(prompt: string): Omit<Provenance, "jobHash"> {
  return {
    presetStack: [],
    presetContrib: Object.fromEntries(promptFragments(prompt).map(fragment => [fragment, ""])),
    derivedFlags: [],
    overrides: [],
    marks: null
  };
}

