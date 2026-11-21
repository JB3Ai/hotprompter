import {readLibrary} from './preset-library-store';
import {mergePresetStack,presetValues,LIBRARY_KINDS} from './preset-library';
import {manualProvenance,promptFragments,type Provenance} from './provenance';

export async function captureProvenance(prompt: string, presetIds: unknown, manualDraft: Record<string,string>): Promise<Provenance> {
  if (!Array.isArray(presetIds) || presetIds.length > 4 || presetIds.some(id=>typeof id!=="string")) throw new Error("Invalid preset stack.");
  const library = await readLibrary();
  const stack = presetIds.map(id=>{
    const preset=library.presets.find(p=>p.id===id && !p.trashedAt && !p.quarantined);
    if(!preset)throw new Error("A composed preset is unavailable. Refresh the library before submitting.");
    return preset;
  }).sort((a,b)=>LIBRARY_KINDS.indexOf(a.kind)-LIBRARY_KINDS.indexOf(b.kind));
  if(new Set(stack.map(p=>p.kind)).size!==stack.length)throw new Error("Only one preset per compose slot is allowed.");
  const result={jobHash:"",...manualProvenance(prompt)};
  const merged=mergePresetStack(stack,manualDraft);
  for(const fragment of promptFragments(prompt)){
    for(const [key,contributor] of Object.entries(merged.contributors)){
      if(contributor && merged.draft[key] && fragment.includes(merged.draft[key]))result.presetContrib[fragment]=contributor;
    }
  }
  result.presetStack=stack.map(p=>({id:p.id,kind:p.kind,version:p.version,name:p.name}));
  const original=Object.assign({},...stack.map(presetValues)) as Record<string,string>;
  result.overrides=Object.entries(manualDraft).filter(([key,value])=>original[key] && original[key]!==value).map(([,value])=>value).filter(Boolean);
  return {...result,presetDefinitions:stack.map(p=>({...p,owns:[...p.owns],rotaries:{...p.rotaries},chips:[...p.chips]}))};
}
