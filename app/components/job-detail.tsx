"use client";
import { useEffect, useState } from "react";
import type { FrozenJob } from "@/lib/snapshot";
import { promptFragments, type Provenance } from "@/lib/provenance";
import { capturePreset } from "@/lib/preset-library";

export type PanelRequest={mode:"seed"|"prompt"|"attributed"|"diff";snapshot:FrozenJob;nonce:number};
type JobRecord={snapshot:FrozenJob;provenance:Provenance};
export function JobDetail({hash,onClose,currentPrompt,onPanelRequest}:{hash:string;onClose:()=>void;currentPrompt:string;onPanelRequest:(request:PanelRequest)=>void}){
 const [record,setRecord]=useState<JobRecord|null>(null);const [error,setError]=useState("");const [notes,setNotes]=useState("");const [diff,setDiff]=useState(false);
 const [promoteKind,setPromoteKind]=useState<'scene'|'subject'|'camera'>('scene');
 useEffect(()=>{let live=true;fetch(`/api/job-record/${hash}`,{cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);if(live){setRecord(data);setNotes(data.provenance.notes??'')}}).catch(e=>{if(live)setError(String(e))});return()=>{live=false}},[hash]);
 async function update(patch:{marks?:Provenance['marks'];notes?:string}){try{const r=await fetch(`/api/job-record/${hash}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});const data=await r.json();if(!r.ok)throw new Error(data.error);setRecord(current=>current?{...current,provenance:{...current.provenance,...data}}:current);setError('')}catch(e){setError(String(e))}}
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.closest('input,textarea,select,button'))return;if(e.key==='Escape')onClose();else if(e.key.toLowerCase()==='k')void update({marks:'keep'});else if(e.key.toLowerCase()==='x')void update({marks:'reject'})};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[hash]);
 const snapshot=record?.snapshot;const provenance=record?.provenance;
 async function promote(){if(!snapshot)return;try{const draft=snapshot.draft??{};const owned=capturePreset(draft,promoteKind);if(!Object.keys(owned.rotaries).length)throw new Error('This job has no captured controls in the selected zone.');const name=window.prompt('Name for the new scoped preset',`${promoteKind} from ${hash.slice(0,8)}`);if(!name)return;const r=await fetch('/api/preset-library',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'capture',name,kind:promoteKind,draft})});const data=await r.json();if(!r.ok)throw new Error(data.error);setError('Promoted to Preset Library.')}catch(e){setError(String(e))}}
 function exportJson(){if(!record)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));a.download=`HOTPROMPTER_${hash.slice(0,8)}.json`;a.click();URL.revokeObjectURL(a.href)}
 return <section className="panel-card stack-sm job-detail" aria-label="Recorded job provenance">
  <div className="row-between"><h3>Recorded job provenance</h3><button className="btn" onClick={onClose}>Close details</button></div>
  {error&&<p className="warn-text" role="status">{error}</p>}
  {snapshot&&provenance&&<>
   <p className="muted small"><code>{snapshot.hash}</code></p><p>Seed {snapshot.seed} · CFG {snapshot.cfg} · {snapshot.width} × {snapshot.height} · {snapshot.steps} steps · {snapshot.sampler}/{snapshot.scheduler} · denoise {snapshot.denoise}</p>
   {snapshot.models&&<p className="muted small">{snapshot.models.unet} · {snapshot.models.clip} · {snapshot.models.vae}</p>}
   <div className="fragment-record">{promptFragments(snapshot.prompt).map(fragment=>{const presetId=provenance.presetContrib[fragment];const preset=provenance.presetStack.find(p=>p.id===presetId);return <p key={fragment} className={preset?`zone-${preset.kind}`:''}>{fragment} <small className="muted">{preset?`${preset.kind}: ${preset.name??preset.id.slice(0,8)} v${preset.version}`:'manual'}{provenance.derivedFlags.includes(fragment)?' · auto':''}</small></p>})}</div>
   <details><summary>Recorded negative prompt</summary><p>{snapshot.negativePrompt||'Off'}</p></details>
   {provenance.overrides.length>0&&<details><summary>Manual overrides</summary><p>{provenance.overrides.join(', ')}</p></details>}
   <div className="row-gap"><button className="btn" onClick={()=>onPanelRequest({mode:'seed',snapshot,nonce:Date.now()})}>Reuse seed</button><button className="btn" onClick={()=>onPanelRequest({mode:'prompt',snapshot,nonce:Date.now()})}>Reuse prompt as manual</button><button className="btn" onClick={()=>onPanelRequest({mode:'attributed',snapshot,nonce:Date.now()})}>Open in panel</button><button className="btn" onClick={()=>setDiff(!diff)}>Diff against current</button><button className="btn" onClick={exportJson}>Export job JSON</button></div>
   {diff&&<div className="job-diff"><div><h3>Recorded</h3>{promptFragments(snapshot.prompt).map(f=><p key={f} className={!promptFragments(currentPrompt).includes(f)?'diff-removed':''}>{promptFragments(currentPrompt).includes(f)?' ':'− '}{f}</p>)}</div><div><h3>Current panel</h3>{promptFragments(currentPrompt).map(f=><p key={f} className={!promptFragments(snapshot.prompt).includes(f)?'diff-added':''}>{promptFragments(snapshot.prompt).includes(f)?' ':'+ '}{f}</p>)}<button className="btn" onClick={()=>onPanelRequest({mode:'diff',snapshot,nonce:Date.now()})}>Run diff with recorded seed</button><p className="muted small">Queues the current panel using this seed. Other current settings are preserved.</p></div></div>}
   <div className="row-gap"><button className="btn" aria-pressed={provenance.marks==='keep'} onClick={()=>void update({marks:provenance.marks==='keep'?null:'keep'})}>Keep (K)</button><button className="btn" aria-pressed={provenance.marks==='reject'} onClick={()=>void update({marks:provenance.marks==='reject'?null:'reject'})}>Reject (X)</button><span className="muted">Mark: {provenance.marks??'unmarked'}</span></div>
   <label className="field-row"><span>Notes (sidecar only)</span><textarea value={notes} maxLength={2000} onChange={e=>setNotes(e.target.value)}/></label><button className="btn" onClick={()=>void update({notes})}>Save notes</button>
   <div className="row-gap"><select aria-label="Promotion zone" value={promoteKind} onChange={e=>setPromoteKind(e.target.value as typeof promoteKind)}><option value="scene">Scene</option><option value="subject">Subject</option><option value="camera">Camera</option></select><button className="btn" onClick={()=>void promote()}>Promote owned controls to preset</button></div>
  </>}
 </section>;
}
