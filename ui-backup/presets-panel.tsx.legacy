"use client";

import { useState, useEffect, useCallback } from "react";
import type { Draft } from "@/lib/options";

type Preset = { id: string; name: string; draft: string; prompt: string; createdAt: string };

export default function PresetsPanel({
  draft,
  validationAllowed,
  onLoad
}: {
  draft: Draft;
  validationAllowed: boolean;
  onLoad: (draft: Draft) => void;
}) {
  const [name, setName] = useState("");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [msg, setMsg] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/presets");
    if (res.ok) setPresets((await res.json()).presets);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function save() {
    const res = await fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, draft })
    });
    if (res.ok) {
      setName("");
      setMsg("Saved");
      setDeleteId(null);
      refresh();
    } else {
      setMsg((await res.json()).error ?? "Save failed");
    }
    setTimeout(() => setMsg(""), 2000);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/presets/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteId(null);
      refresh();
    }
  }

  return (
    <section className="preset-panel" aria-label="Saved prompt presets">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Prompt library</p>
          <h3>Saved prompts</h3>
        </div>
      </div>

      <div className="preset-save">
        <input
          aria-label="Preset name"
          placeholder="Preset name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="button" disabled={!validationAllowed || !name.trim()} onClick={save}>
          Save current prompt
        </button>
      </div>
      {msg && <p className="preset-message" role="status">{msg}</p>}

      {presets.length === 0 && <p className="empty-state">No saved presets yet.</p>}
      {presets.map((p) => (
        <article key={p.id} className="preset-card">
          <div className="preset-card__header">
            <div>
              <strong>{p.name}</strong>
              <span>{new Date(p.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <p className="preset-card__preview">
            {p.prompt.slice(0, 120)}{p.prompt.length > 120 ? "…" : ""}
          </p>
          <div className="preset-card__actions">
            <button type="button" onClick={() => onLoad(JSON.parse(p.draft))}>Load</button>
            {deleteId === p.id ? (
              <>
                <button type="button" className="destructive" onClick={() => remove(p.id)}>Confirm delete</button>
                <button type="button" className="secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              </>
            ) : (
              <button type="button" className="destructive" onClick={() => setDeleteId(p.id)}>Delete</button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
