import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readLibrary, mutateLibrary, exportLibrary, verifyLibraryImport } from "@/lib/preset-library-store";
import { capturePreset, validateLibraryPreset, optionId, keysForKind, type LibraryPreset } from "@/lib/preset-library";
import { FIELD_DEFS } from "@/lib/options";
import { readPresetRatings } from "@/lib/job-records";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request){
  const library=await readLibrary();
  const url=new URL(req.url);
  if(url.searchParams.get("export")==="1"){
    const ids=url.searchParams.get("ids")?.split(",");
    return NextResponse.json(exportLibrary(library.presets.filter(p=>!p.trashedAt && (!ids || ids.includes(p.id)))));
  }
  return NextResponse.json({...library,ratings:await readPresetRatings()},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:Request){
  try{
    const text=await req.text();if(text.length>2_000_000)throw new Error("Preset request is too large.");
    const body=JSON.parse(text);
    const result=await mutateLibrary(library=>{
      const find=(id:string)=>{const p=library.presets.find(p=>p.id===id);if(!p)throw new Error("Preset not found.");return p;};
      if(body.action==="capture"){
        const parent=body.parentId?find(body.parentId):null;
        if(parent&&(parent.kind!==body.kind||parent.trashedAt||parent.quarantined))throw new Error("Capture parent must be an active preset of the same kind.");
        const preset=validateLibraryPreset({id:randomUUID(),schema:2,version:parent?parent.version+1:1,name:body.name,kind:body.kind,
          ...capturePreset(body.draft ?? {},body.kind),notes:"",source:"authored",createdAt:new Date().toISOString(),quarantined:false});
        if(parent){preset.parentId=parent.id;preset.source='forked';}
        if(!Object.keys(preset.rotaries).length)throw new Error("Select at least one supported control in this zone before capturing.");
        library.presets.push(preset);return {preset};
      }
      if(body.action==="import"){
        const imported=verifyLibraryImport(body.envelope);
        if(imported.some(p=>library.presets.some(existing=>existing.id===p.id)||library.tombstones.some(t=>t.id===p.id)))throw new Error("An imported preset ID already exists or is tombstoned. Import cancelled.");
        library.presets.push(...imported.map(p=>({...p,source:"imported" as const,quarantined:true})));return {imported:imported.length};
      }
      if(body.action==="fork" || body.action==="variants"){
        const parent=find(body.id);if(parent.trashedAt || parent.quarantined)throw new Error("Restore or accept this preset first.");
        let choices:string[]=[""];
        if(body.action==="variants"){
          const count=Number(body.count);if(!Number.isInteger(count)||count<2||count>6||!keysForKind(parent.kind).includes(body.key))throw new Error("Choose one owned key and 2–6 variants.");
          const field=FIELD_DEFS.find(field=>!field.explicit && field.key===body.key);
          choices=(field?.options ?? []).filter(value=>optionId(body.key,value)!==parent.rotaries[body.key]).slice(0,count);
          if(choices.length!==count)throw new Error("This control has too few distinct options.");
        }
        const children=choices.map((value,index)=>validateLibraryPreset({...parent,id:randomUUID(),parentId:parent.id,version:parent.version+1,
          name:`${parent.name.slice(0,60)} ${body.action==="variants"?`variant ${index+1}`:"fork"}`,source:"forked",createdAt:new Date().toISOString(),
          rotaries:body.action==="variants"?{...parent.rotaries,[body.key]:optionId(body.key,value)}:{...parent.rotaries},
          owns:body.action==="variants"?[...new Set([...parent.owns,body.key])]:parent.owns}));
        library.presets.push(...children);return {presets:children};
      }
      if(body.action==='merge'){
        const parent=find(body.id);const other=find(body.otherId);
        if(parent.kind!==other.kind||parent.trashedAt||other.trashedAt||parent.quarantined||other.quarantined)throw new Error('Only active presets of the same kind can be merged.');
        const preset=validateLibraryPreset({...parent,id:randomUUID(),name:`${parent.name.slice(0,60)} merged`,parentId:parent.id,version:Math.max(parent.version,other.version)+1,
          source:'forked',createdAt:new Date().toISOString(),owns:[...new Set([...parent.owns,...other.owns])],rotaries:{...parent.rotaries,...other.rotaries},chips:[...new Set([...parent.chips,...other.chips])]});
        library.presets.push(preset);return {preset};
      }
      const ids=Array.isArray(body.ids)?body.ids:[body.id];
      if(ids.length>500 || !ids.every((id:unknown)=>typeof id==="string"))throw new Error("Invalid selection.");
      const selected=ids.map(find);
      for(const preset of selected){
        if(body.action==="trash")preset.trashedAt=new Date().toISOString();
        else if(body.action==="restore"){delete preset.trashedAt;}
        else if(body.action==="accept")preset.quarantined=false;
        else if(body.action==="rename"){
          if(typeof body.name!=="string"||!body.name.trim()||body.name.length>80)throw new Error("Name must contain 1–80 characters.");
          preset.name=body.name.trim();
        }else throw new Error("Unknown preset action.");
      }
      return {updated:selected.length};
    });
    return NextResponse.json(result);
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Preset operation failed."},{status:400});}
}
