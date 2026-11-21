"use client";

import { useEffect, useRef, useState } from "react";
import { JobDetail, type PanelRequest } from "./job-detail";

type GalleryItem = { id: string; promptId: string; filename: string; promptPreview: string; negativePrompt: string; seed: number | null; steps: number | null; cfg: number | null; hash: string; url: string; downloadUrl: string; subfolder: string;hasProvenance?:boolean;marks?:"keep"|"reject"|null;keepRate?:number|null };

export function GalleryPanel({ active, onReuseSeed, currentPrompt, onPanelRequest }: { active: boolean; onReuseSeed: (seed: number) => void;currentPrompt:string;onPanelRequest:(request:PanelRequest)=>void }) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailHash,setDetailHash]=useState<string|null>(null);
  const [ranked,setRanked]=useState(false);
  async function markImage(item:GalleryItem,marks:"keep"|"reject"){
    try{const r=await fetch(`/api/job-record/${item.hash}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({marks:item.marks===marks?null:marks})});const data=await r.json();if(!r.ok)throw new Error(data.error);setItems(current=>current.map(candidate=>candidate.id===item.id?{...candidate,marks:data.marks}:candidate));}catch(e){setError(String(e))}
  }
  const hasLoadedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/gallery?limit=36", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gallery unavailable");
      setItems(Array.isArray(data.items) ? data.items : []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gallery unavailable");
      setItems([]);
    } finally { setLoading(false); }
  }
  useEffect(() => {
    if (!active || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    void load();
  }, [active]);

  useEffect(() => {
    if (!selected) return;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selected]);

  function closeLightbox() {
    lastTriggerRef.current?.focus();
    setSelected(null);
  }

  async function deleteImage(item: GalleryItem) {
    if (!window.confirm(`Delete ${item.filename} permanently from the local ComfyUI output folder?`)) return;
    setDeletingId(item.id);
    setError("");
    try {
      const response = await fetch("/api/gallery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: item.filename, subfolder: item.subfolder })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Image could not be deleted");
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      if (selected?.id === item.id) setSelected(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Image could not be deleted");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="stack">
      <section className="panel-card">
        <div className="row-between">
          <div><p className="eyebrow">Gallery</p><h2>Completed images</h2></div>
          <button type="button" className="btn btn-small" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
        </div>
        <p className="muted small">Local ComfyUI output only. Images are served through same-origin API routes.</p>
        <label className="check-row"><input type="checkbox" checked={ranked} onChange={e=>setRanked(e.target.checked)}/><span>Sort by contributing preset keep rate (at least 5 marks)</span></label>
        {error && <p className="error-text" role="status">{error}</p>}
        {!loading && !error && items.length === 0 && <p className="muted">No completed HOTPROMPTER images found in local ComfyUI history yet.</p>}
        <div className="gallery-grid">
          {(ranked?[...items].sort((a,b)=>(b.keepRate??-1)-(a.keepRate??-1)):items).map((item) => (
            <article key={item.id} className="gallery-card" tabIndex={0} onKeyDown={event=>{if(event.target!==event.currentTarget||!item.hasProvenance)return;if(event.key.toLowerCase()==='k')void markImage(item,'keep');if(event.key.toLowerCase()==='x')void markImage(item,'reject')}}>
              <button type="button" className="gallery-thumb" onClick={(event) => { lastTriggerRef.current = event.currentTarget; setSelected(item); }} aria-label={`Open image ${item.filename}`}>
                <img src={item.url} alt={item.promptPreview ? `Generated image: ${item.promptPreview.slice(0, 80)}` : item.filename} loading="lazy" />
              </button>
              <div className="gallery-meta">
                <strong title={item.filename}>{item.filename}</strong>
                {item.promptPreview && <p className="muted small">{item.promptPreview}</p>}
                {(item.seed !== null || item.cfg !== null) && <p className="muted small">Seed {item.seed ?? "—"} · {item.steps ?? "—"} steps · CFG {item.cfg?.toFixed(1) ?? "—"}</p>}
                {item.negativePrompt && <details><summary className="small">Negative prompt</summary><p className="muted small">{item.negativePrompt}</p></details>}
                {item.hash && <p className="muted small">Snapshot: <code>{item.hash}</code></p>}
                {item.hasProvenance&&<div className="row-gap"><button className="btn btn-small" aria-pressed={item.marks==='keep'} onClick={()=>void markImage(item,'keep')}>Keep (K)</button><button className="btn btn-small" aria-pressed={item.marks==='reject'} onClick={()=>void markImage(item,'reject')}>Reject (X)</button>{item.keepRate!=null&&<small>{Math.round(item.keepRate*100)}% preset keep rate</small>}</div>}
                <div className="row-gap">
                  <a className="btn btn-small" href={item.downloadUrl} download={item.filename}>Download PNG</a>
                  {item.seed !== null && <button type="button" className="btn btn-small" onClick={() => onReuseSeed(item.seed as number)}>Reuse seed</button>}
                  <button type="button" className="btn btn-small" disabled={!/^[a-f0-9]{64}$/.test(item.hash??'')} onClick={()=>setDetailHash(item.hash)}>Provenance / diff</button>
                  <button type="button" className="btn btn-small btn-danger" disabled={deletingId === item.id} onClick={() => void deleteImage(item)}>{deletingId === item.id ? "Deleting…" : "Delete"}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      {detailHash&&<JobDetail key={detailHash} hash={detailHash} onClose={()=>setDetailHash(null)} currentPrompt={currentPrompt} onPanelRequest={onPanelRequest}/>}

      {selected && (
        <div ref={dialogRef} className="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer" onClick={closeLightbox}>
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <img src={selected.url} alt={selected.promptPreview || selected.filename} />
            <div className="row-between lightbox-actions">
              <span className="muted small">{selected.promptPreview || selected.filename}</span>
              <div className="row-gap">
                <a className="btn btn-small" href={selected.downloadUrl} download={selected.filename}>Download</a>
                {selected.seed !== null && <button type="button" className="btn btn-small" onClick={() => { onReuseSeed(selected.seed as number); closeLightbox(); }}>Reuse seed</button>}
                <button type="button" className="btn btn-small btn-danger" disabled={deletingId === selected.id} onClick={() => void deleteImage(selected)}>{deletingId === selected.id ? "Deleting…" : "Delete"}</button>
                <button ref={closeButtonRef} type="button" className="btn btn-small" onClick={closeLightbox}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
