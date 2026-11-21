export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { listOllamaModels } = await import("./lib/ollama");
  // Warm discovery only. This does not load an LLM or delay server readiness.
  void listOllamaModels().catch((error) => {
    console.warn(`[HOTPROMPTER] Ollama model discovery unavailable at startup: ${error instanceof Error ? error.message : "unknown error"}`);
  });
}
