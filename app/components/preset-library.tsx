"use client";

import { useEffect, useRef, useState } from "react";
import { keysForKind, presetValues, fragmentOverlap, reconcilePreset, LIBRARY_KINDS, type LibraryPreset } from "@/lib/preset-library";
import type { Draft } from "@/lib/options";
import type { PresetKind } from "@/lib/provenance";
import { FIELD_DEFS } from "@/lib/options";

export function PresetLibraryPanel({active,draft,stack,onApply,lockedKeys,onToggleKey,onOpenPanel}:{
  active:boolean;draft:Draft;stack:LibraryPreset[];onApply:(stack:LibraryPreset[],resetManual?:boolean)=>void;
  lockedKeys:string[];onToggleKey:(key:string)=>void;onOpenPanel:()=>void;
}){
  const [presets,setPresets]=useState<LibraryPreset[]>([]);
  const [query,setQuery]=useState("");const [kind,setKind]=useState("all");
  const [ratings,setRatings]=useState<Record<string,{n:number;kept:number;rate:number|null}>>({});
  const [keepFloor,setKeepFloor]=useState(0);const [dateFrom,setDateFrom]=useState('');const [dateTo,setDateTo]=useState('');
  const [source,setSource]=useState("all");const [view,setView]=useState("active");
  const [name,setName]=useState("");const [captureKind,setCaptureKind]=useState<PresetKind>("scene");
  const [message,setMessage]=useState("");const [selected,setSelected]=useState<string[]>([]);
  const [slotLocks,setSlotLocks]=useState<string[]>([]);
  const [preview,setPreview]=useState<LibraryPreset[]|null>(null);
  const [lineage,setLineage]=useState<string|null>(null);const [showAll,setShowAll]=useState(false);
  const [variants,setVariants]=useState<LibraryPreset[]>([]);const [variantKey,setVariantKey]=useState("");const [count,setCount]=useState(2);
  const [savedSearches,setSavedSearches]=useState<string[]>([]);
  const [scrollTop,setScrollTop]=useState(0);const [columns,setColumns]=useState(3);
  const loaded=useRef(false);const file=useRef<HTMLInputElement>(null);const lastSelected=useRef<string|null>(null);
  async function load(){try{const r=await fetch('/api/preset-library',{cache:'no-store'});const data=await r.json();if(!r.ok)throw new Error(data.error);setRatings(data.ratings??{});const resolved=(data.presets??[]).map(reconcilePreset);setPresets(resolved.filter((p:ReturnType<typeof reconcilePreset>)=>!p.readOnly).map((p:ReturnType<typeof reconcilePreset>)=>p.preset));const skipped=resolved.reduce((sum:number,p:ReturnType<typeof reconcilePreset>)=>sum+p.skipped,0);if(skipped)setMessage(`${skipped} options from an older version were skipped.`);if(resolved.some((p:ReturnType<typeof reconcilePreset>)=>p.readOnly))setMessage('Some presets require a schema upgrade and cannot be composed. Originals are retained in storage.')}catch(e){setMessage(String(e))}}
  useEffect(()=>{if(active&&!loaded.current){loaded.current=true;void load()}},[active]);
  useEffect(()=>{
    try{const saved=JSON.parse(sessionStorage.getItem('hotprompter.library.filters')??'{}');setQuery(saved.query??'');setKind(saved.kind??'all');setSource(saved.source??'all');setSavedSearches(saved.searches??[])}catch{}
    const resize=()=>setColumns(window.innerWidth<650?1:window.innerWidth<1000?2:3);resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);
  },[]);
  useEffect(()=>{sessionStorage.setItem('hotprompter.library.filters',JSON.stringify({query,kind,source,searches:savedSearches}));setScrollTop(0)},[query,kind,source,savedSearches]);
  useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setPreview(null)};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[]);
  async function mutate(body:unknown){const r=await fetch('/api/preset-library',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error);await load();return data}
  async function action(body:unknown){try{await mutate(body);setMessage('Library updated.')}catch(e){setMessage(String(e))}}
  async function exportSelected(ids?:string[]){const r=await fetch(`/api/preset-library?export=1${ids?.length?`&ids=${encodeURIComponent(ids.join(','))}`:''}`);const data=await r.json();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='hotprompter-presets.json';a.click();URL.revokeObjectURL(a.href)}
  function propose(preset:LibraryPreset){
    if(preset.trashedAt||preset.quarantined||slotLocks.includes(preset.kind)){setMessage('Restore, accept, or unlock this slot first.');return}
    const next=[...stack.filter(p=>p.kind!==preset.kind),preset].sort((a,b)=>LIBRARY_KINDS.indexOf(a.kind)-LIBRARY_KINDS.indexOf(b.kind));setPreview(next);
  }
  const filtered=presets.filter(p=>(view==='trash'?Boolean(p.trashedAt):view==='quarantine'?p.quarantined&&!p.trashedAt:!p.trashedAt&&!p.quarantined&&!variants.some(v=>v.id===p.id)))
    .filter(p=>kind==='all'||p.kind===kind).filter(p=>source==='all'||p.source===source)
    .filter(p=>keepFloor===0||(ratings[p.id]?.rate??-1)>=keepFloor/100)
    .filter(p=>(!dateFrom||p.createdAt.slice(0,10)>=dateFrom)&&(!dateTo||p.createdAt.slice(0,10)<=dateTo))
    .filter(p=>`${p.name} ${p.notes} ${Object.values(presetValues(p)).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const rowHeight=285;const start=Math.max(0,Math.floor(scrollTop/rowHeight)-1);const visible=filtered.slice(start*columns,(start+5)*columns);
  function select(preset:LibraryPreset,shift:boolean){const prior=filtered.findIndex(p=>p.id===lastSelected.current);const index=filtered.indexOf(preset);setSelected(current=>shift&&prior>=0?[...new Set([...current,...filtered.slice(Math.min(prior,index),Math.max(prior,index)+1).map(p=>p.id)])]:current.includes(preset.id)?current.filter(id=>id!==preset.id):[...current,preset.id]);lastSelected.current=preset.id}
  async function fork(p:LibraryPreset){try{const data=await mutate({action:'fork',id:p.id});const child=data.presets[0];onApply([...stack.filter(p=>p.kind!==child.kind),child]);onOpenPanel();setMessage('Fork created; parent preserved.')}catch(e){setMessage(String(e))}}
  const root=presets.find(p=>p.id===lineage);const lineageNodes=root?presets.filter(p=>p.id===root.id||p.parentId===root.id||p.id===root.parentId):[];
  return <div className="stack">
    <section className="panel-card stack-sm">
      <div className="row-between"><div><p className="eyebrow">Preset Library</p><h2>Compose and build on it</h2></div><button className="btn" onClick={()=>void load()}>Refresh</button></div>
      <div className="library-filter-bar">
        <input aria-label="Search preset library" placeholder="Search names, fragments, notes…" value={query} onChange={e=>setQuery(e.target.value)}/>
        <select aria-label="Preset kind filter" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All kinds</option>{LIBRARY_KINDS.map(k=><option key={k}>{k}</option>)}</select>
        <select aria-label="Preset source filter" value={source} onChange={e=>setSource(e.target.value)}><option value="all">All sources</option>{['authored','imported','forked'].map(k=><option key={k}>{k}</option>)}</select>
        <select aria-label="Library view" value={view} onChange={e=>setView(e.target.value)}><option value="active">Active</option><option value="quarantine">Import quarantine</option><option value="trash">Trash (30 days)</option></select>
        <select aria-label="Keep rate floor" value={keepFloor} onChange={e=>setKeepFloor(Number(e.target.value))}><option value={0}>Any keep rate</option><option value={50}>50%+ (n ≥ 5)</option><option value={75}>75%+ (n ≥ 5)</option><option value={90}>90%+ (n ≥ 5)</option></select>
        <input type="date" aria-label="Created after" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/><input type="date" aria-label="Created before" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
      </div>
      <div className="row-gap"><button className="btn btn-small" disabled={!query} onClick={()=>setSavedSearches(s=>[...new Set([...s,query])].slice(0,12))}>Save search</button>{savedSearches.map(s=><button className="btn btn-small" key={s} onClick={()=>setQuery(s)}>{s}</button>)}</div>
      <div className="compose-slots">{LIBRARY_KINDS.map(k=>{const preset=stack.find(p=>p.kind===k);const locked=slotLocks.includes(k);return <section key={k} className={`compose-slot zone-${k} ${locked?'is-locked':''}`} onDragOver={e=>{if(!locked)e.preventDefault()}} onDrop={e=>{e.preventDefault();const p=presets.find(p=>p.id===e.dataTransfer.getData('text/plain'));if(p?.kind===k)propose(p)}}>
        <strong>{k}</strong><span>{preset?.name??'Empty slot'}</span><button className="btn btn-small" aria-pressed={locked} onClick={()=>setSlotLocks(s=>locked?s.filter(x=>x!==k):[...s,k])}>{locked?'Unlock':'Lock'}</button>
        {preset&&!locked&&<button className="btn btn-small" onClick={()=>setPreview(stack.filter(p=>p.kind!==k))}>Remove</button>}
      </section>})}</div>
      <div className="row-gap">{lockedKeys.map(key=><button key={key} className="btn btn-small" onClick={()=>onToggleKey(key)}>Unpin {FIELD_DEFS.find(f=>f.key===key)?.label??key}</button>)}<button className="btn btn-small" onClick={()=>onApply(stack,true)}>Reset manual control overrides</button></div>
      {preview&&<section className="subcard stack-sm" aria-label="Preset merge preview"><h3>Preview before applying</h3><p className="muted small">Pinned controls and manual control edits take priority. Escape cancels.</p>
        {preview.map(p=><div key={p.id} className={`zone-${p.kind}`}><strong>{p.name}</strong><p>{Object.values(presetValues(p)).join(', ')}</p></div>)}
        {stack.filter(p=>!preview.some(n=>n.id===p.id)).map(p=><del key={p.id}>{p.name}: {Object.values(presetValues(p)).join(', ')}</del>)}
        <div className="row-gap"><button className="btn btn-primary" onClick={()=>{onApply(preview);setPreview(null)}}>Apply composition</button><button className="btn" onClick={()=>setPreview(null)}>Cancel</button></div>
      </section>}
      <div className="library-filter-bar"><input aria-label="New library preset name" placeholder="New preset from current controls" value={name} onChange={e=>setName(e.target.value)}/><select aria-label="Capture preset kind" value={captureKind} onChange={e=>setCaptureKind(e.target.value as PresetKind)}>{LIBRARY_KINDS.map(k=><option key={k}>{k}</option>)}</select><button className="btn" disabled={!name.trim()} onClick={()=>void action({action:'capture',name,kind:captureKind,draft,parentId:stack.find(p=>p.kind===captureKind)?.id})}>Capture new {stack.some(p=>p.kind===captureKind)?'fork':''}</button></div>
      <div className="row-gap"><button className="btn btn-small" onClick={()=>void exportSelected(selected)}>Export {selected.length?'selected':'library'}</button><button className="btn btn-small" onClick={()=>file.current?.click()}>Import JSON</button><input ref={file} hidden type="file" accept="application/json,.json" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>2_000_000)throw new Error('File too large.');await mutate({action:'import',envelope:JSON.parse(await f.text())});setView('quarantine');setMessage('Verified import is quarantined until accepted.')}catch(error){setMessage(String(error))}e.target.value=''}}/>
        {selected.length>0&&<button className="btn btn-danger btn-small" onClick={()=>void action({action:view==='trash'?'restore':view==='quarantine'?'accept':'trash',ids:selected})}>{view==='trash'?'Restore':view==='quarantine'?'Accept':'Trash'} {selected.length}</button>}
      </div>
      {message&&<p role="status" className="muted">{message}</p>}
    </section>
    <section className="panel-card"><p className="muted small">{filtered.length} presets · select cards with Shift for bulk actions · drag to the matching unlocked slot.</p>
      <div className="library-scroll" onScroll={e=>setScrollTop(e.currentTarget.scrollTop)}><div style={{height:Math.ceil(filtered.length/columns)*rowHeight,position:'relative'}}>
      {visible.map((p,index)=>{const absolute=start*columns+index;const duplicate=presets.find(other=>other.id!==p.id&&other.kind===p.kind&&!other.trashedAt&&fragmentOverlap(p,other)>=.85);return <article key={p.id} tabIndex={0} draggable={!slotLocks.includes(p.kind)&&!p.quarantined&&!p.trashedAt} onDragStart={e=>e.dataTransfer.setData('text/plain',p.id)} onClick={e=>select(p,e.shiftKey)} onKeyDown={e=>{if(e.key.toLowerCase()==='f'&&e.target===e.currentTarget)void fork(p)}} className={`library-card zone-${p.kind} ${selected.includes(p.id)?'is-selected':''} ${slotLocks.includes(p.kind)?'is-incompatible':''}`} style={{position:'absolute',top:Math.floor(absolute/columns)*rowHeight,left:`${absolute%columns*100/columns}%`,width:`calc(${100/columns}% - 12px)`,height:270}}>
        <div className="library-card-art" aria-hidden="true"><span>{p.kind}</span><span>● {Object.keys(p.rotaries).length} controls</span></div><strong>{p.name}</strong><small>{p.kind} · v{p.version} · {p.source} · {ratings[p.id]?.rate!=null?`${Math.round((ratings[p.id].rate??0)*100)}% keep (${ratings[p.id].n})`:'new'}{ratings[p.id]?.n>=8&&ratings[p.id].kept===0?' · retire?':''}</small><p className="muted small library-fragments">{Object.values(presetValues(p)).join(', ')}</p>
        {duplicate&&<small className="warn-text">≥85% overlap: {duplicate.name}</small>}
        <div className="row-gap" onClick={e=>e.stopPropagation()}><button className="btn btn-small" disabled={slotLocks.includes(p.kind)||Boolean(p.trashedAt)||p.quarantined} onClick={()=>propose(p)}>Compose</button><button className="btn btn-small" disabled={Boolean(p.trashedAt)||p.quarantined} onClick={()=>void fork(p)}>Fork</button><button className="btn btn-small" onClick={()=>{setLineage(p.id);setVariantKey(keysForKind(p.kind).find(key=>!lockedKeys.includes(key))??'')}}>Lineage / variants</button><button className="btn btn-small" onClick={()=>void exportSelected([p.id])}>Export</button><button className="btn btn-small" onClick={()=>{const name=window.prompt('Rename preset',p.name);if(name)void action({action:'rename',id:p.id,name})}}>Rename</button>{duplicate&&<button className="btn btn-small" onClick={()=>{if(window.confirm(`Create a merged child? ${duplicate.name} wins conflicting controls; originals stay intact.`))void action({action:'merge',id:p.id,otherId:duplicate.id})}}>Merge overlap</button>}</div>
      </article>})}</div></div>
    </section>
    {root&&<section className="panel-card stack-sm" aria-label="Preset lineage"><div className="row-between"><h3>Lineage: {root.name}</h3><button className="btn" onClick={()=>setLineage(null)}>Close</button></div>
      {(showAll?lineageNodes:lineageNodes.slice(0,4)).map(p=><p key={p.id}>{p.id===root.parentId?'Parent':p.id===root.id?'Selected':'Child'}: {p.name} · v{p.version}</p>)}{lineageNodes.length>4&&<button className="btn" onClick={()=>setShowAll(!showAll)}>{showAll?'Show fewer':'Show all'}</button>}
      <label className="field-row"><span>Variant control key</span><select value={variantKey} onChange={e=>setVariantKey(e.target.value)}>{keysForKind(root.kind).filter(key=>!lockedKeys.includes(key)).map(key=><option key={key} value={key}>{FIELD_DEFS.find(f=>f.key===key)?.label??key}</option>)}</select></label><label className="field-row"><span>Children (2–6)</span><input type="number" min={2} max={6} value={count} onChange={e=>setCount(Number(e.target.value))}/></label><button className="btn" disabled={!variantKey||lockedKeys.includes(variantKey)} onClick={async()=>{try{const data=await mutate({action:'variants',id:root.id,key:variantKey,count});setVariants(data.presets)}catch(e){setMessage(String(e))}}}>Create comparison variants</button>
    </section>}
    {variants.length>0&&<section className="panel-card stack-sm" aria-label="Variant comparison"><h3>Compare variants</h3>{variants.map(p=><div key={p.id} className="subcard"><strong>{p.name}</strong><p>{Object.values(presetValues(p)).join(', ')}</p><div className="row-gap"><button className="btn" onClick={()=>setVariants(v=>v.filter(x=>x.id!==p.id))}>Keep in library</button><button className="btn btn-danger" onClick={()=>{void action({action:'trash',id:p.id});setVariants(v=>v.filter(x=>x.id!==p.id))}}>Trash</button></div></div>)}</section>}
  </div>;
}
