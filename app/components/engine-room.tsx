"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardStatusResponse, QueueJob } from "@/lib/dashboard-contract";

export function EngineRoomPanel({ active, status, onRefreshStatus }: { active: boolean; status: DashboardStatusResponse | null; onRefreshStatus: () => void }) {
  const [comfy, setComfy] = useState<{ connected: boolean; ready: boolean; missing: string[]; workflow: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const hasCheckedRef = useRef(false);

  async function check() {
    setChecking(true);
    try {
      const res = await fetch("/api/generate-image", { cache: "no-store" });
      setComfy(await res.json());
    } catch {
      setComfy({ connected: false, ready: false, missing: [], workflow: "Qwen Image 2.1 GGUF · CPU/RAM" });
    } finally { setChecking(false); }
  }
  useEffect(() => {
    if (!active || hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    void check();
  }, [active]);

  async function cancel(job: QueueJob) {
    setCancelling(job.promptId);
    setMsg("");
    try {
      const res = await fetch("/api/image-queue", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promptId: job.promptId }) });
      if (!res.ok) throw new Error();
      setMsg(`Cancelled job ${job.promptId.slice(0, 8)}.`);
      onRefreshStatus();
    } catch { setMsg("That local image job could not be cancelled."); }
    finally { setCancelling(null); }
  }

  const jobs = status?.queue.jobs ?? [];
  return (
    <div className="stack">
      <section className="panel-card">
        <div className="row-between">
          <div><p className="eyebrow">Engine Room</p><h2>Local engine status</h2></div>
          <button type="button" className="btn btn-small" onClick={() => { check(); onRefreshStatus(); }} disabled={checking}>{checking ? "Checking…" : "Refresh"}</button>
        </div>
        <div className="service-grid">
          {(status?.services ?? []).map((s) => (
            <article key={s.id} className="service-card">
              <div className="row-gap"><span className={`dot dot--${s.state}`} aria-hidden="true" /><strong>{s.label}</strong></div>
              <p className="muted">{s.state === "not-configured" ? "Not configured" : s.state.charAt(0).toUpperCase() + s.state.slice(1)}</p>
              <small className="muted">{s.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-card">
        <h3>ComfyUI workflow (read-only)</h3>
        <p className="muted">{comfy?.workflow ?? "Qwen Image 2.1 GGUF · CPU/RAM"}</p>
        <p className={comfy?.ready ? "ok-text" : comfy?.connected ? "warn-text" : "error-text"}>
          {checking ? "Checking…" : comfy?.ready ? "Ready to generate" : comfy?.connected ? "Online but workflow incomplete" : "Offline — start ComfyUI locally, then refresh"}
        </p>
        {comfy?.connected && !comfy.ready && comfy.missing.length > 0 && <p className="muted">Missing: {comfy.missing.join(", ")}</p>}
        <p className="muted small">Configuration is managed by local server environment and ComfyUI setup. This dashboard does not expose or change AI URLs or model files.</p>
      </section>

      <section className="panel-card">
        <div className="row-between">
          <h3>Image queue</h3>
          <div className="queue-counts" aria-live="polite"><strong>{status?.queue.running ?? 0}</strong> running · <strong>{status?.queue.pending ?? 0}</strong> waiting · <strong>{status?.queue.total ?? 0}</strong> total</div>
        </div>
        {jobs.length === 0 ? <p className="muted">No queued or running image jobs.</p> : (
          <ul className="queue-list">
            {jobs.map((job) => (
              <li key={job.promptId} className="queue-row">
                <div className="queue-main">
                  <strong>{job.state === "running" ? "Running" : `Waiting ${job.position}`}</strong>
                  {job.state === "running" && (
                    <div className="stack-sm" aria-live="polite">
                      <span>{job.progress?.connected ? job.progress.stage : "Connecting to live progress…"}</span>
                      {job.progress?.connected && job.progress.value != null && job.progress.max != null ? (
                        <>
                          <span>Sampling step {job.progress.value} / {job.progress.max} · {Math.floor(job.progress.value / job.progress.max * 100)}% of sampling</span>
                          <progress aria-label="Sampling progress" value={job.progress.value} max={job.progress.max} style={{ width: "100%" }} />
                        </>
                      ) : <small className="muted">{job.samplingSteps ?? "Unknown"} sampling steps planned. Waiting for a reported step; model loading may take time on CPU.</small>}
                      <small className="muted">{job.progress?.updatedAt ? `Last engine update: ${new Date(job.progress.updatedAt).toLocaleTimeString()}. ` : ""}Sampling reaching 100% does not mean the image has finished saving.</small>
                    </div>
                  )}
                  <span className="muted">{job.promptPreview || "Prompt details unavailable"}</span>
                  <small className="muted">{job.width && job.height ? `${job.width} × ${job.height} · ` : ""}ID {job.promptId.slice(0, 8)}</small>
                </div>
                <button type="button" className="btn btn-small btn-danger" onClick={() => cancel(job)} disabled={cancelling !== null}
                  aria-label={`Cancel ${job.state} image job ${job.promptId.slice(0, 8)}`}>{cancelling === job.promptId ? "Cancelling…" : "Cancel job"}</button>
              </li>
            ))}
          </ul>
        )}
        {msg && <p role="status" className="muted">{msg}</p>}
      </section>
    </div>
  );
}
