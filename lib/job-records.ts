import path from "node:path";
import { mkdir, readFile, writeFile, rename, unlink, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { FrozenJob } from "./snapshot";
import type { Provenance } from "./provenance";

const root = path.join(process.cwd(), ".data", "jobs");
export function validJobHash(hash: string): boolean { return /^[a-f0-9]{64}$/.test(hash); }
function recordPath(hash: string, suffix: string): string {
  if (!validJobHash(hash)) throw new Error("Invalid job hash.");
  return path.join(root, `${hash}.${suffix}.json`);
}

export async function saveFrozenRecord(snapshot: FrozenJob): Promise<void> {
  await mkdir(root, { recursive: true });
  try {
    await writeFile(recordPath(snapshot.hash, "snapshot"), JSON.stringify(snapshot), { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

export async function readFrozenRecord(hash: string): Promise<FrozenJob | null> {
  try { return JSON.parse(await readFile(recordPath(hash, "snapshot"), "utf8")) as FrozenJob; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

export async function readMarks(hash: string): Promise<{ marks: Provenance["marks"]; notes: string }> {
  try { return JSON.parse(await readFile(recordPath(hash, "marks"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { marks: null, notes: "" }; throw error; }
}

// Serialize mutations per hash and atomically replace only the mutable sidecar.
const shared = globalThis as typeof globalThis & { hotprompterMarkWrites?: Map<string, Promise<unknown>> };
const writes = shared.hotprompterMarkWrites ??= new Map<string, Promise<unknown>>();
export async function updateMarks(hash: string, patch: { marks?: Provenance["marks"]; notes?: string }) {
  const prior = writes.get(hash) ?? Promise.resolve();
  const pending = prior.catch(() => {}).then(async () => {
    if (!await readFrozenRecord(hash)) throw new Error("Frozen job not found.");
    const result = { ...await readMarks(hash), ...patch };
    const destination = recordPath(hash, "marks");
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try { await writeFile(temporary, JSON.stringify(result), { flag: "wx" }); await rename(temporary, destination); }
    finally { await unlink(temporary).catch(() => {}); }
    return result;
  });
  writes.set(hash, pending);
  try { return await pending; }
  finally { if (writes.get(hash) === pending) writes.delete(hash); }
}

export type PresetRating={n:number;kept:number;rate:number|null};
export async function readPresetRatings():Promise<Record<string,PresetRating>>{
  const ratings:Record<string,PresetRating>={};
  let files:string[];try{files=await readdir(root);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return ratings;throw error;}
  for(const filename of files.filter(name=>/^[a-f0-9]{64}\.snapshot\.json$/.test(name))){
    const hash=filename.slice(0,64);const mark=await readMarks(hash);if(!mark.marks)continue;
    const snapshot=await readFrozenRecord(hash);const provenance=snapshot?.provenance;if(!provenance)continue;
    const contributed=new Set(Object.values(provenance.presetContrib).filter(Boolean));
    for(const preset of provenance.presetStack){
      if(!contributed.has(preset.id))continue;
      const rating=ratings[preset.id]??={n:0,kept:0,rate:null};rating.n++;if(mark.marks==='keep')rating.kept++;
      if(rating.n>=5)rating.rate=rating.kept/rating.n;
    }
  }
  return ratings;
}
