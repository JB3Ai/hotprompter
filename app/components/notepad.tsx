"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "hotprompter:notepad:v1";
const SLOT_IDS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
type StoredNotepad = { version: 1; draft: string; selectedSlot: string; slots: Record<string, string> };

export function Notepad({ open, onClose, text, onChange, onLoad, onCopy, copied }: {
  open: boolean; onClose: () => void; text: string; onChange: (text: string) => void;
  onLoad: () => void; onCopy: () => void; copied: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selectedSlot, setSelectedSlot] = useState("1");
  const [slots, setSlots] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as StoredNotepad | null;
      if (saved?.version === 1) {
        setSlots(saved.slots ?? {});
        setSelectedSlot(SLOT_IDS.includes(saved.selectedSlot) ? saved.selectedSlot : "1");
        if (!text && saved.draft) onChange(saved.draft);
      }
    } catch { /* A corrupt local note should never block the workspace. */ }
    setHydrated(true);
  // Restore once. Parent callbacks intentionally do not retrigger hydration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: StoredNotepad = { version: 1, draft: text, selectedSlot, slots };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, selectedSlot, slots, text]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  function selectSlot(slot: string) {
    setSelectedSlot(slot);
    if (slots[slot]) onChange(slots[slot]);
  }

  return (
    <dialog ref={dialog} className="sidebar-notepad" aria-labelledby="notepad-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="stack">
        <div className="row-between">
          <div><p className="eyebrow">Local memory bank</p><h2 id="notepad-title">Prompt notepad</h2></div>
          <button type="button" className="btn btn-small" onClick={onClose} autoFocus>Close</button>
        </div>
        <p className="muted small">Auto-saved only in this browser. Select a key to recall an occupied slot, or choose an empty key before storing.</p>
        <label className="field-row" htmlFor="prompt-notepad-notes"><span>Notes</span></label>
        <textarea id="prompt-notepad-notes" value={text} onChange={(event) => onChange(event.target.value)} placeholder="Paste or write a prompt…" />
        <div className="memory-bank" aria-label="Ten local prompt memory slots">
          {SLOT_IDS.map((slot) => (
            <button key={slot} type="button" className={`memory-key ${selectedSlot === slot ? "is-selected" : ""} ${slots[slot] ? "is-stored" : ""}`} aria-pressed={selectedSlot === slot} aria-label={`Memory slot ${slot}${slots[slot] ? ", stored" : ", empty"}`} onClick={() => selectSlot(slot)}>
              <span className="memory-led" aria-hidden="true" />{slot}
            </button>
          ))}
        </div>
        <p className="muted small" aria-live="polite">Slot {selectedSlot}: {slots[selectedSlot] ? "stored prompt" : "empty"}</p>
        <div className="row-gap">
          <button type="button" className="btn" disabled={!text} onClick={() => setSlots((current) => ({ ...current, [selectedSlot]: text }))}>Store in {selectedSlot}</button>
          <button type="button" className="btn" disabled={!slots[selectedSlot]} onClick={() => onChange(slots[selectedSlot] ?? "")}>Load slot</button>
          <button type="button" className="btn btn-secondary" disabled={!slots[selectedSlot]} onClick={() => setSlots((current) => { const next = { ...current }; delete next[selectedSlot]; return next; })}>Clear slot</button>
        </div>
        <div className="row-gap notepad-actions">
          <button type="button" className="btn" disabled={!text} onClick={onCopy}>{copied ? "Copied!" : "Copy notes"}</button>
          <button type="button" className="btn btn-primary" disabled={!text} onClick={() => { onLoad(); onClose(); }}>Use as active prompt</button>
          <button type="button" className="btn btn-secondary" disabled={!text} onClick={() => onChange("")}>Clear notes</button>
        </div>
      </div>
    </dialog>
  );
}
