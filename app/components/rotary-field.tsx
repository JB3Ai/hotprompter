"use client";
import { useRef } from "react";

export function RotaryField({ id, label, value, options, onChange }: {
  id: string; label: string; value: string; options: readonly string[]; onChange: (value: string) => void;
}) {
  const values = ["", ...options];
  const index = Math.max(0, values.indexOf(value));
  const drag = useRef<{ y: number; index: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const select = (next: number) => onChange(values[Math.max(0, Math.min(values.length - 1, next))]);
  return <div className="field-row rotary-field">
    <label htmlFor={id}>{label}</label>
    <div className="rotary-control">
      <button type="button" className="rotary-knob" aria-label={`Adjust ${label}: ${value || "not selected"}`}
        title="Click for next option. Drag up/down or use arrow keys. Home clears; End selects last."
        onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } select((index + 1) % values.length); }}
        onKeyDown={(event) => {
          const next = event.key === "ArrowUp" || event.key === "ArrowRight" ? index + 1
            : event.key === "ArrowDown" || event.key === "ArrowLeft" ? index - 1
            : event.key === "Home" ? 0 : event.key === "End" ? values.length - 1 : null;
          if (next !== null) { event.preventDefault(); select(next); }
        }}
        onPointerDown={(event) => { if (event.button !== 0) return; suppressClick.current = false; drag.current = { y: event.clientY, index, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { const start = drag.current; if (!start) return; const delta = Math.round((start.y - event.clientY) / 12); if (delta !== 0) start.moved = true; if (start.moved) select(start.index + delta); }}
        onPointerUp={() => { suppressClick.current = drag.current?.moved ?? false; drag.current = null; }}
        onPointerCancel={() => { drag.current = null; suppressClick.current = true; }}>
        <span className="knob-cap" aria-hidden="true" style={{ transform: `rotate(${-135 + index / Math.max(1, values.length - 1) * 270}deg)` }}><span className="knob-pointer" /></span>
      </button>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">— select —</option>{options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  </div>;
}
