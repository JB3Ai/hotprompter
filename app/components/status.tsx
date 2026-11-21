"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardStatusResponse } from "@/lib/dashboard-contract";

const POLL_MS = 5_000;

function label(state: string) {
  if (state === "not-configured") return "Not configured";
  return state.charAt(0).toUpperCase() + state.slice(1);
}

export function useDashboardStatus() {
  const [status, setStatus] = useState<DashboardStatusResponse | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/dashboard-status", { cache: "no-store", signal });
      if (!res.ok) throw new Error();
      const data = await res.json() as DashboardStatusResponse;
      setStatus(data);
      setError("");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Local service status unavailable.");
    }
  }, []);
  useEffect(() => {
    const c = new AbortController();
    refresh(c.signal);
    const t = window.setInterval(() => refresh(c.signal), POLL_MS);
    return () => { c.abort(); window.clearInterval(t); };
  }, [refresh]);
  return { status, error, refresh };
}

export function LocalStatusRail({ status, error }: { status: DashboardStatusResponse | null; error: string }) {
  return (
    <header className="status-rail" aria-label="Local AI system status">
      <div className="status-rail__brand">
        <strong>Local AI workspace</strong>
        <span className="muted"> · No cloud processing</span>
      </div>
      <div className="status-rail__services" aria-live="polite">
        {(status?.services ?? []).map((s) => (
          <div key={s.id} className="service-chip" title={s.detail}>
            <span className={`dot dot--${s.state}`} aria-hidden="true" />
            <span className="sr-only">{s.label} status: {label(s.state)}</span>
            <span><strong>{s.label}</strong> <small>{label(s.state)}</small></span>
          </div>
        ))}
        {!status && !error && <span className="muted">Checking local services…</span>}
      </div>
      <div className="status-rail__counts" aria-live="polite" aria-label="Image queue counts">
        <span><strong>{status?.queue.running ?? 0}</strong> running</span>
        <span><strong>{status?.queue.pending ?? 0}</strong> waiting</span>
        <span><strong>{status?.queue.total ?? 0}</strong> total</span>
      </div>
      {error && <p className="error-text" role="status">{error}</p>}
    </header>
  );
}
