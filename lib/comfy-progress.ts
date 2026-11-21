import { COMFYUI_URL } from "./comfyui";
import { assertLocalAiUrl } from "./local-ai-url";

export type JobProgress = {
  connected: boolean;
  node: string | null;
  value: number | null;
  max: number | null;
  updatedAt: string | null;
};
type Monitor = { socket: WebSocket; progress: JobProgress; lastRead: number };
const shared = globalThis as typeof globalThis & { comfyProgress?: Map<string, Monitor> };
const monitors = shared.comfyProgress ??= new Map<string, Monitor>();

// One server-side connection per active job, shared by dashboard polls.
// The browser never receives the ComfyUI address or client ID.
export function readJobProgress(promptId: string, clientId: string): JobProgress {
  for (const [id, monitor] of monitors) {
    if (Date.now() - monitor.lastRead > 60_000) {
      monitor.socket.close();
      monitors.delete(id);
    }
  }
  const existing = monitors.get(promptId);
  if (existing) {
    existing.lastRead = Date.now();
    return { ...existing.progress };
  }
  assertLocalAiUrl(COMFYUI_URL, "ComfyUI");
  const url = new URL(COMFYUI_URL + "/ws");
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("clientId", clientId);
  const socket = new WebSocket(url);
  const monitor: Monitor = {
    socket, lastRead: Date.now(),
    progress: { connected: false, node: null, value: null, max: null, updatedAt: null }
  };
  monitors.set(promptId, monitor);
  // Progress-only observer: never request binary/latent previews or decode them.
  // The launch profile also sets --preview-method none to avoid their compute cost.
  socket.addEventListener("open", () => { monitor.progress.connected = true; });
  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    try {
      const { type, data } = JSON.parse(event.data);
      if (!data || (data.prompt_id && data.prompt_id !== promptId)) return;
      if (type === "executing") {
        monitor.progress.node = data.node == null ? null : String(data.node);
        monitor.progress.value = null;
        monitor.progress.max = null;
      } else if (type === "progress" && data.prompt_id === promptId) {
        monitor.progress.node = String(data.node);
        monitor.progress.value = Number.isFinite(data.value) ? data.value : null;
        monitor.progress.max = Number.isFinite(data.max) && data.max > 0 ? data.max : null;
      } else return;
      monitor.progress.updatedAt = new Date().toISOString();
    } catch { /* Ignore previews and messages unrelated to progress. */ }
  });
  const disconnect = () => {
    monitor.progress.connected = false;
    if (monitors.get(promptId) === monitor) monitors.delete(promptId);
  };
  socket.addEventListener("close", disconnect);
  socket.addEventListener("error", () => { socket.close(); disconnect(); });
  return { ...monitor.progress };
}
