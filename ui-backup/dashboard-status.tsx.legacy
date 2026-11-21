"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardStatusResponse, QueueJob } from "@/lib/dashboard-contract";

const POLL_INTERVAL_MS = 5_000;

function serviceStateLabel(state: string): string {
  if (state === "not-configured") return "Not configured";
  return state.charAt(0).toUpperCase() + state.slice(1);
}

export default function DashboardStatus({
  onStatus
}: {
  onStatus?: (status: DashboardStatusResponse | null) => void;
}) {
  const [status, setStatus] = useState<DashboardStatusResponse | null>(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/dashboard-status", { cache: "no-store", signal });
      if (!response.ok) throw new Error("Status unavailable");
      const payload = await response.json() as DashboardStatusResponse;
      setStatus(payload);
      onStatus?.(payload);
      setError("");
    } catch (requestError) {
      if ((requestError as Error).name !== "AbortError") {
        setError("Local service status is unavailable.");
        onStatus?.(null);
      }
    }
  }, [onStatus]);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    const timer = window.setInterval(() => refresh(controller.signal), POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function cancel(job: QueueJob) {
    setCancelling(job.promptId);
    try {
      const response = await fetch("/api/image-queue", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId: job.promptId })
      });
      if (!response.ok) throw new Error("Cancel failed");
      await refresh();
    } catch {
      setError("That local image job could not be cancelled.");
    } finally {
      setCancelling(null);
    }
  }

  return (
    <aside className="local-dashboard" aria-label="Local AI system status">
      <div className="local-dashboard__heading">
        <div>
          <strong>Local AI workspace</strong>
          <span> · No cloud processing</span>
        </div>
        <div className="queue-totals" aria-live="polite">
          <span><strong>{status?.queue.running ?? 0}</strong> running</span>
          <span><strong>{status?.queue.pending ?? 0}</strong> waiting</span>
          <span><strong>{status?.queue.total ?? 0}</strong> total</span>
        </div>
      </div>

      <div className="service-list" aria-live="polite">
        {(status?.services ?? []).map((service) => (
          <div className="service-item" key={service.id} title={service.detail}>
            <span
              className={`service-dot service-dot--${service.state}`}
              aria-label={`${service.label} status: ${serviceStateLabel(service.state)}`}
              role="status"
            />
            <span>
              <strong>{service.label}</strong>
              <small>{serviceStateLabel(service.state)} · {service.detail}</small>
            </span>
          </div>
        ))}
        {!status && !error && <span>Checking local services…</span>}
      </div>

      {status && status.queue.jobs.length > 0 && (
        <details className="queue-details">
          <summary>View image queue ({status.queue.total})</summary>
          <div className="queue-jobs">
            {status.queue.jobs.map((job) => (
              <div className="queue-job" key={job.promptId}>
                <div>
                  <strong>{job.state === "running" ? "Running" : `Waiting ${job.position}`}</strong>
                  <span>{job.promptPreview}</span>
                  <small>
                    {job.width && job.height ? `${job.width} × ${job.height} · ` : ""}
                    {job.promptId.slice(0, 8)}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => cancel(job)}
                  disabled={cancelling !== null}
                  aria-label={`Cancel ${job.state} image job ${job.promptId.slice(0, 8)}`}
                >
                  {cancelling === job.promptId ? "Cancelling…" : "Cancel"}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {error && <p className="local-dashboard__error" role="status">{error}</p>}
    </aside>
  );
}
