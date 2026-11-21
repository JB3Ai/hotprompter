import path from "node:path";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { validateLibraryPreset, type LibraryPreset } from "./preset-library";

type Library = { presets: LibraryPreset[]; tombstones: Array<{id:string;schema:number}> };
const destination=path.join(process.cwd(),".data","preset-library.json");
const shared=globalThis as typeof globalThis & { hotprompterLibraryWrites?: Promise<unknown> };
export async function readLibrary(): Promise<Library> {
  try {return JSON.parse(await readFile(destination,"utf8")) as Library;}
  catch(error){if((error as NodeJS.ErrnoException).code === "ENOENT")return {presets:[],tombstones:[]};throw error;}
}
export async function mutateLibrary<T>(mutate:(library:Library)=>T):Promise<T> {
  const prior=shared.hotprompterLibraryWrites ?? Promise.resolve();
  const pending=prior.catch(()=>{}).then(async()=>{
    const library=await readLibrary();
    const expired=library.presets.filter(p=>p.trashedAt && Date.now()-Date.parse(p.trashedAt)>30*86400000);
    for(const preset of expired)library.tombstones.push({id:preset.id,schema:2});
    library.presets=library.presets.filter(p=>!expired.includes(p));
    const result=mutate(library);
    await mkdir(path.dirname(destination),{recursive:true});
    const temporary=`${destination}.${randomUUID()}.tmp`;
    try{await writeFile(temporary,JSON.stringify(library),{flag:"wx"});await rename(temporary,destination);}
    finally{await unlink(temporary).catch(()=>{});}
    return result;
  });
  shared.hotprompterLibraryWrites=pending;
  try{return await pending;}finally{if(shared.hotprompterLibraryWrites===pending)shared.hotprompterLibraryWrites=undefined;}
}
export function canonicalJson(value: unknown): string {
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(",")}]`;
  if(value && typeof value === "object")return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson((value as Record<string,unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function exportLibrary(presets:LibraryPreset[]){
  const body={schema:2,presets};
  return {body,sha256:createHash("sha256").update(canonicalJson(body)).digest("hex")};
}
export function verifyLibraryImport(raw:unknown):LibraryPreset[]{
  const envelope=raw as ReturnType<typeof exportLibrary>;
  if(!envelope?.body || envelope.body.schema!==2 || !Array.isArray(envelope.body.presets)
    || envelope.body.presets.length>500 || !/^[a-f0-9]{64}$/.test(envelope.sha256 ?? ""))throw new Error("Invalid preset export.");
  if(createHash("sha256").update(canonicalJson(envelope.body)).digest("hex")!==envelope.sha256)throw new Error("Preset import checksum does not match.");
  const presets=envelope.body.presets.map(validateLibraryPreset);
  if(new Set(presets.map(p=>p.id)).size!==presets.length)throw new Error("Duplicate preset IDs in import.");
  return presets;
}
