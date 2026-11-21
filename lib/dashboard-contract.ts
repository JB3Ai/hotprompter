export type ServiceState = "online" | "offline" | "degraded" | "not-configured";
export type QueueJobState = "running" | "pending";

export type LocalServiceStatus = {
  id: "hotprompter" | "lmstudio" | "ollama" | "comfyui";
  label: string;
  state: ServiceState;
  detail: string;
};

export type QueueJob = {
  promptId: string;
  state: QueueJobState;
  position: number;
  promptPreview: string;
  width: number | null;
  height: number | null;
  seed: number | null;
  createdAt: string | null;
  progress?: { connected: boolean; stage: string; value: number | null; max: number | null; updatedAt: string | null };
  samplingSteps?: number | null;
};

export type QueueSnapshot = {
  running: number;
  pending: number;
  total: number;
  jobs: QueueJob[];
};

export type DashboardStatusResponse = {
  localOnly: true;
  generatedAt: string;
  services: LocalServiceStatus[];
  queue: QueueSnapshot;
};
