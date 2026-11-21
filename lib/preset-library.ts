import { FIELD_DEFS, type Draft } from "./options";
import type { PresetKind } from "./provenance";

export type LibraryPreset = {
  id: string; name: string; kind: PresetKind; schema: 2; version: number;
  parentId?: string; owns: string[]; rotaries: Record<string, string>; chips: string[];
  notes: string; source: "authored" | "imported" | "forked";
  createdAt: string; trashedAt?: string; quarantined: boolean;
};
export const LIBRARY_KINDS: PresetKind[] = ["complete", "scene", "subject", "camera"];
const safeFields = FIELD_DEFS.filter(field => !field.explicit);
export function keysForKind(kind: PresetKind): string[] {
  if (kind === "complete") return safeFields.map(field => field.key);
  return safeFields.filter(field => kind === "scene" ? ["scene", "background", "lighting", "action", "expression"].includes(field.key)
    : kind === "camera" ? ["camera", "renderStyle"].includes(field.key)
    : !["scene", "background", "lighting", "action", "expression", "camera", "renderStyle"].includes(field.key)).map(field => field.key);
}
export function optionId(key: string, value: string): string { return `${key}:${encodeURIComponent(value)}`; }
export function optionValue(key: string, id: string): string | null {
  const field = safeFields.find(field => field.key === key);
  return field?.options.find(value => optionId(key, value) === id) ?? null;
}
export function presetValues(preset: LibraryPreset): Draft {
  return Object.fromEntries(Object.entries(preset.rotaries).map(([key, id]) => [key, optionValue(key, id) ?? ""]));
}
export function validateLibraryPreset(raw: unknown): LibraryPreset {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid preset object.");
  const p = raw as LibraryPreset;
  if (p.schema !== 2) throw new Error("Unsupported preset schema; export from this version to upgrade before importing.");
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(p.id) || !LIBRARY_KINDS.includes(p.kind)
    || typeof p.name !== "string" || !p.name.trim() || p.name.length > 80
    || !Number.isInteger(p.version) || p.version < 1 || p.version > 100000
    || (p.parentId !== undefined && !/^[A-Za-z0-9_-]{8,100}$/.test(p.parentId))) throw new Error("Invalid preset identity, kind, or version.");
  const allowed = new Set(keysForKind(p.kind));
  if (!Array.isArray(p.owns) || p.owns.length > 80 || p.owns.some(key => !allowed.has(key))
    || new Set(p.owns).size !== p.owns.length) throw new Error("Preset owns keys outside its zone.");
  if (!p.rotaries || typeof p.rotaries !== "object" || Array.isArray(p.rotaries)
    || Object.entries(p.rotaries).some(([key, id]) => !p.owns.includes(key) || typeof id !== "string" || optionValue(key, id) === null)) throw new Error("Preset has unknown options or controls outside owns.");
  if (!Array.isArray(p.chips) || p.chips.length > 80 || p.chips.some(id => typeof id !== "string" || !p.owns.some(key => optionValue(key, id) !== null))) throw new Error("Unknown chip option.");
  if (typeof p.notes !== "string" || p.notes.length > 2000 || !["authored", "imported", "forked"].includes(p.source)
    || typeof p.quarantined !== "boolean" || !Number.isFinite(Date.parse(p.createdAt))
    || (p.trashedAt !== undefined && !Number.isFinite(Date.parse(p.trashedAt)))) throw new Error("Invalid preset metadata.");
  return {
    id:p.id, name:p.name.trim(), kind:p.kind, schema:2, version:p.version,
    ...(p.parentId ? {parentId:p.parentId} : {}), owns:[...p.owns], rotaries:{...p.rotaries}, chips:[...new Set(p.chips)],
    notes:p.notes, source:p.source, createdAt:p.createdAt, quarantined:p.quarantined,
    ...(p.trashedAt ? {trashedAt:p.trashedAt} : {})
  };
}
export function capturePreset(draft: Draft, kind: PresetKind): Pick<LibraryPreset, "owns" | "rotaries" | "chips"> {
  const owns = keysForKind(kind);
  const rotaries = Object.fromEntries(owns.filter(key => draft[key] && safeFields.find(field => field.key === key)?.options.includes(draft[key])).map(key => [key, optionId(key, draft[key])]));
  return { owns, rotaries, chips: [] };
}
export function mergePresetStack(stack: LibraryPreset[], manual: Draft, locks: string[] = [], current: Draft = {}) {
  const draft: Draft = {};
  const contributors: Record<string,string> = {};
  const ordered = [...stack].sort((a,b)=>LIBRARY_KINDS.indexOf(a.kind)-LIBRARY_KINDS.indexOf(b.kind));
  for (const preset of ordered) {
    for (const [key,value] of Object.entries(presetValues(preset))) { draft[key]=value;contributors[key]=preset.id; }
  }
  for (const [key,value] of Object.entries(manual)) {draft[key]=value;contributors[key]="";}
  for (const key of locks) if (current[key] !== undefined) {draft[key]=current[key];contributors[key]="";}
  return {draft,contributors,chips:[...new Set(ordered.flatMap(p=>p.chips))]};
}
export function fragmentOverlap(a: LibraryPreset,b: LibraryPreset): number {
  const x=new Set([...Object.values(a.rotaries),...a.chips]);
  const y=new Set([...Object.values(b.rotaries),...b.chips]);
  const union=new Set([...x,...y]);
  return union.size ? [...x].filter(id=>y.has(id)).length/union.size : 0;
}

export function reconcilePreset(preset:LibraryPreset):{preset:LibraryPreset;skipped:number;readOnly:boolean}{
  if(preset.schema!==2 || !LIBRARY_KINDS.includes(preset.kind))return {preset,skipped:0,readOnly:true};
  const allowed=new Set(keysForKind(preset.kind));
  const removed=new Set<string>();
  const rotaries=Object.fromEntries(Object.entries(preset.rotaries??{}).filter(([key,id])=>{
    const valid=allowed.has(key)&&optionValue(key,id)!==null;if(!valid)removed.add(id);return valid;
  }));
  const owns=(preset.owns??[]).filter(key=>allowed.has(key));
  const chips=(preset.chips??[]).filter(id=>{const valid=owns.some(key=>optionValue(key,id)!==null);if(!valid)removed.add(id);return valid;});
  return {preset:{...preset,owns,rotaries,chips},skipped:removed.size,readOnly:false};
}
