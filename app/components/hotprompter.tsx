"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { DashboardStatusResponse } from "@/lib/dashboard-contract";
import { GROUPS, EXPLICIT_GROUP, ADULT_STYLE_GROUP, ADULT_THEME_GROUP, EXPLICIT_KEYS, FIELD_DEFS, emptyDraft, randomizeDraft, hasExplicitSelections, type Draft } from "@/lib/options";
import { buildPrompt, validatePrompt, type ValidationResult } from "@/lib/prompt";
import { buildNegativePrompt, GENERATION_PRESETS, validateNegativePrompt, type GenerationPresetId, type NegativeGroups } from "@/lib/negative";
import PresetsPanel from "../presets-panel";
import { ImageJobDrawer, type ImageJob } from "./image-job";
import { Notepad } from "./notepad";
import { RotaryField } from "./rotary-field";
import { mergePresetStack, type LibraryPreset } from "@/lib/preset-library";
import type { PanelRequest } from "./job-detail";

type ComfyStatus = { connected: boolean; ready: boolean; missing: string[]; workflow: string; encoder?: { filename: string; loader: string; warning: string | null } };
type PromptProvider = "lmstudio" | "ollama";
type PromptSource = "controls" | "manual" | PromptProvider | "notepad";
type GenerationMode = GenerationPresetId | "custom";
type OllamaModelOption = { name: string; model: string; size: number; details?: { family?: string; parameter_size?: string; quantization_level?: string } };

function ReservedControlGroup({ label }: { label: string }) {
  return (
    <section className="field-group reserved-control-group" aria-label={`${label}, awaiting configuration`}>
      <div className="reserved-group-title"><span>{label}</span><small>Awaiting parameters</small></div>
      <div className="reserved-control-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => <div className="reserved-control" key={index}><span className="reserved-knob" /><span className="reserved-readout">—</span></div>)}
      </div>
    </section>
  );
}

function waitForPoll(delayMs: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { window.clearTimeout(timer); reject(new DOMException("Generation polling stopped", "AbortError")); };
    const timer = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, delayMs);
    if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
  });
}

export function HotprompterPanel({ dashboardStatus, onQueueRefresh, onShowPrompt, seedRequest, onDraftChange, onPromptChange, composition, lockedKeys, onToggleKey, presetStack, panelRequest, onClearStack, onRestoreStack }: { dashboardStatus: DashboardStatusResponse | null; onQueueRefresh: () => void; onShowPrompt: () => void; seedRequest?: { value: number; nonce: number } | null; onDraftChange:(draft:Draft)=>void;onPromptChange:(prompt:string)=>void;composition:{stack:LibraryPreset[];resetManual:boolean;nonce:number}|null;lockedKeys:string[];onToggleKey:(key:string)=>void;presetStack:LibraryPreset[];panelRequest:PanelRequest|null;onClearStack:()=>void;onRestoreStack:(stack:LibraryPreset[])=>void }) {
  const [explicitMode, setExplicitMode] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const basePrompt = buildPrompt(draft, { allowExplicit: explicitMode });
  const [activePrompt, setActivePrompt] = useState(basePrompt);
  const [promptSource, setPromptSource] = useState<PromptSource>("controls");
  const [validation, setValidation] = useState<ValidationResult>(() => validatePrompt(basePrompt));
  const [serverChecked, setServerChecked] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<ImageJob | null>(null);
  const [jobOpen, setJobOpen] = useState(false);
  const [comfyStatus, setComfyStatus] = useState<ComfyStatus | null>(null);
  const [checkingComfy, setCheckingComfy] = useState(true);
  const [resolution, setResolution] = useState(512);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("draft");
  const [steps, setSteps] = useState(GENERATION_PRESETS.draft.steps);
  const [requestedCfg, setRequestedCfg] = useState(GENERATION_PRESETS.draft.cfg);
  const [negativeGroups, setNegativeGroups] = useState<NegativeGroups>({ ...GENERATION_PRESETS.draft.groups });
  const [negativePrompt, setNegativePrompt] = useState("");
  const [negativeLocked, setNegativeLocked] = useState(false);
  const [negativeCustomized, setNegativeCustomized] = useState(false);
  const [seed, setSeed] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState("");
  const [enhanceModel, setEnhanceModel] = useState("");
  const [provider, setProvider] = useState<PromptProvider>("ollama");
  const [lmStudioModels, setLmStudioModels] = useState<string[]>([]);
  const [lmStudioModel, setLmStudioModel] = useState("");
  const [ollamaModels, setOllamaModels] = useState<OllamaModelOption[]>([]);
  const [ollamaModel, setOllamaModel] = useState("");
  const [providerModelsError, setProviderModelsError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [describeError, setDescribeError] = useState("");
  const [notepadText, setNotepadText] = useState("");
  const [notepadOpen, setNotepadOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generationAbortRef = useRef<AbortController | null>(null);
  const submissionSequenceRef = useRef(0);
  const manualDraftRef=useRef<Draft>({});
  const manualPromptRef=useRef<string|null>(null);
  const appliedRequest=useRef<number|null>(null);
  const negativeValidation = validateNegativePrompt(negativePrompt);
  const resolvedCfgPreview = negativeValidation.value && requestedCfg < 2.5 ? 3 : negativeValidation.value ? requestedCfg : 1;
  const serviceStateMap = Object.fromEntries((dashboardStatus?.services ?? []).map((service) => [service.id, service]));
  const lmStudioService = serviceStateMap.lmstudio;
  const ollamaService = serviceStateMap.ollama;
  const lmStudioReady = lmStudioService?.state === "online" && Boolean(lmStudioModel);
  const ollamaReady = ollamaService?.state === "online" && Boolean(ollamaModel);
  const providerReady = provider === "lmstudio" ? lmStudioReady : ollamaReady;
  const providerLabel = provider === "lmstudio" ? "LM Studio" : "Ollama";
  const latestJobActive = Boolean(job && !job.image && !job.error);
  const queueHasJobs = (dashboardStatus?.queue.total ?? 0) > 0;

  useEffect(() => { setMounted(true); }, []);
  useEffect(()=>{onDraftChange(draft)},[draft,onDraftChange]);
  useEffect(()=>{onPromptChange(activePrompt)},[activePrompt,onPromptChange]);
  useEffect(()=>{
    if(!composition)return;
    if(composition.resetManual){manualDraftRef.current={};manualPromptRef.current=null;}
    setDraft(current=>({...emptyDraft,...mergePresetStack(composition.stack,manualDraftRef.current,lockedKeys,current).draft}));
    if(manualPromptRef.current!==null){setActivePrompt(manualPromptRef.current);setPromptSource('manual');}else setPromptSource('controls');
    // Lock changes affect subsequent merges; they must not reapply an old merge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[composition]);
  useEffect(()=>{
    if(!panelRequest||appliedRequest.current===panelRequest.nonce)return;
    appliedRequest.current=panelRequest.nonce;
    setSeed(String(panelRequest.snapshot.seed));
    if(panelRequest.mode==='diff'){void generateImage(panelRequest.snapshot.seed);return;}
    if(panelRequest.mode==='prompt'){
      editActivePrompt(panelRequest.snapshot.prompt,'manual');
      setNegativePrompt(panelRequest.snapshot.negativePrompt);setNegativeCustomized(true);onClearStack();
      manualDraftRef.current={};
    }
    if(panelRequest.mode==='attributed'){
      const saved=panelRequest.snapshot;
      setDraft({...emptyDraft,...saved.draft});setActivePrompt(saved.prompt);setPromptSource('manual');manualPromptRef.current=null;manualDraftRef.current={};
      setNegativePrompt(saved.negativePrompt);setNegativeCustomized(true);setSteps(saved.steps);setRequestedCfg(saved.cfg);
      void fetch('/api/preset-library',{cache:'no-store'}).then(r=>r.json()).then(data=>{
        const wanted=saved.provenance?.presetStack??[];
        const restored=wanted.map(p=>(data.presets as LibraryPreset[]).find(candidate=>candidate.id===p.id&&candidate.version===p.version&&!candidate.trashedAt&&!candidate.quarantined)).filter((p):p is LibraryPreset=>Boolean(p));
        onRestoreStack(restored);
        if(restored.length!==wanted.length)setEnhanceError('Some recorded presets are archived or unavailable. The recorded prompt is loaded; its original provenance remains in Gallery.');
      }).catch(()=>setEnhanceError('Could not restore the preset stack. The recorded prompt is loaded.'));
    }
  },[panelRequest]);
  useEffect(() => { if (promptSource === "controls") { setActivePrompt(basePrompt); setServerChecked(false); } }, [basePrompt, promptSource]);
  useEffect(() => { setValidation(validatePrompt(activePrompt)); }, [activePrompt]);
  useEffect(() => {
    if (!negativeLocked && !negativeCustomized) {
      setNegativePrompt(buildNegativePrompt(negativeGroups, activePrompt));
    }
  }, [activePrompt, negativeGroups, negativeLocked, negativeCustomized]);
  useEffect(() => {
    if (seedRequest) setSeed(String(seedRequest.value));
  }, [seedRequest]);
  useEffect(() => { void checkComfyUI(); }, []);
  useEffect(() => {
    let live = true;
    fetch("/api/prompt-models", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as {
          lmstudio?: { models?: string[]; selected?: string; error?: string | null };
          ollama?: { models?: OllamaModelOption[]; selected?: string; error?: string | null };
        };
        if (!response.ok) throw new Error("Prompt model lists unavailable");
        if (!live) return;
        const lmModels = data.lmstudio?.models ?? [];
        const ollamaOptions = data.ollama?.models ?? [];
        setLmStudioModels(lmModels);
        setLmStudioModel(lmModels.includes(data.lmstudio?.selected ?? "") ? data.lmstudio?.selected ?? "" : lmModels[0] ?? "");
        setOllamaModels(ollamaOptions);
        setOllamaModel(ollamaOptions.find((model) => model.name === data.ollama?.selected || model.model === data.ollama?.selected)?.name ?? ollamaOptions[0]?.name ?? "");
        setProviderModelsError(data.lmstudio?.error || data.ollama?.error || "");
      })
      .catch((error) => { if (live) setProviderModelsError(error instanceof Error ? error.message : "Prompt model lists unavailable"); });
    return () => { live = false; };
  }, []);
  useEffect(() => () => generationAbortRef.current?.abort(), []);

  function editActivePrompt(value: string, source: PromptSource = "manual") {
    if(source==='manual'||source==='notepad')manualPromptRef.current=value;
    setActivePrompt(value);
    setPromptSource(source);
    setServerChecked(false);
    setEnhanceError("");
    setEnhanceModel("");
  }

  async function checkComfyUI() {
    setCheckingComfy(true);
    try { const response = await fetch("/api/generate-image", { cache: "no-store" }); setComfyStatus(await response.json()); }
    catch { setComfyStatus({ connected: false, ready: false, missing: [], workflow: "Qwen Image 2.1 GGUF · CPU/RAM" }); }
    finally { setCheckingComfy(false); }
  }

  async function checkPrompt() {
    const response = await fetch("/api/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft, prompt: activePrompt }) });
    const data = await response.json();
    setValidation(data.validation ?? validatePrompt(activePrompt));
    setServerChecked(true);
  }

  async function enhancePrompt() {
    if (!providerReady) { setEnhanceError(`${providerLabel} is not ready. Start the configured local model, then refresh status.`); return; }
    setEnhancing(true); setEnhanceError("");
    try {
      const response = await fetch("/api/enhance-prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft, prompt: activePrompt, provider, model: provider === "ollama" ? ollamaModel : lmStudioModel }) });
      const data = await response.json();
      if (!response.ok || typeof data.prompt !== "string" || !data.prompt.trim()) { setEnhanceError(data.error ?? `${providerLabel} could not enhance this prompt.`); return; }
      setActivePrompt(data.prompt); setPromptSource(provider); setEnhanceModel(data.model ?? providerLabel); setValidation(data.validation ?? validatePrompt(data.prompt)); setServerChecked(true);
    } catch { setEnhanceError(`HOTPROMPTER could not reach ${providerLabel} on the local network.`); }
    finally { setEnhancing(false); }
  }

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(() => setCopied(null), 1500);
  }

  function applyGenerationPreset(id: GenerationPresetId) {
    const preset = GENERATION_PRESETS[id];
    setGenerationMode(id);
    setSteps(preset.steps);
    setRequestedCfg(preset.cfg);
    setNegativeGroups({ ...preset.groups });
    setNegativeCustomized(false);
    setNegativeLocked(false);
    setNegativePrompt(buildNegativePrompt(preset.groups, activePrompt));
  }

  function updateNegativeGroup(key: keyof NegativeGroups, enabled: boolean) {
    const next = { ...negativeGroups, [key]: enabled };
    setNegativeGroups(next);
    setGenerationMode("custom");
    setNegativeCustomized(false);
    setNegativePrompt(buildNegativePrompt(next, activePrompt));
  }

  function randomizeSeed() {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    setSeed(String(value[0]));
  }

  async function generateImage(seedOverride?:number) {
    if (!comfyStatus?.ready || submitting) return;
    if(!validatePrompt(activePrompt).allowed || !negativeValidation.ok){setEnhanceError('Check the active and negative prompts before queueing.');return;}
    const submittedPrompt = activePrompt;
    const submittedNegative = negativeValidation.value;
    const submittedResolution = resolution;
    const submissionSequence = ++submissionSequenceRef.current;
    generationAbortRef.current?.abort();
    const controller = new AbortController();
    generationAbortRef.current = controller;
    setSubmitting(true); setJobOpen(true);
    setJob({ promptId: "", prompt: submittedPrompt, negativePrompt: submittedNegative, status: "Sending prompt to ComfyUI…", width: submittedResolution, height: submittedResolution, image: null, filename: "HOTPROMPTER.png", error: "", seed: seedOverride??(seed ? Number(seed) : null), steps, cfg: resolvedCfgPreview, hash: "" });
    try {
      const response = await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft, prompt: submittedPrompt, negativePrompt: submittedNegative, width: submittedResolution, height: submittedResolution, seed:seedOverride??seed, steps, cfg: requestedCfg, presetStack:presetStack.map(p=>p.id),manualDraft:{...manualDraftRef.current,...Object.fromEntries(lockedKeys.map(key=>[key,draft[key]]))} }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !data.promptId) { setJob((current) => current ? { ...current, error: data.error ?? "ComfyUI did not accept the workflow." } : current); return; }
      setJob((current) => current ? { ...current, promptId: data.promptId, negativePrompt: data.negativePrompt ?? submittedNegative, seed: data.seed ?? current.seed, steps: data.steps ?? steps, cfg: data.cfg ?? resolvedCfgPreview, hash: data.hash ?? "", status: "Queued in ComfyUI…" } : current); onQueueRefresh();
      if (submissionSequenceRef.current === submissionSequence) setSubmitting(false);
      while (true) {
        await waitForPoll(2000, controller.signal);
        const statusResponse = await fetch(`/api/generate-image?promptId=${encodeURIComponent(data.promptId)}`, { cache: "no-store", signal: controller.signal });
        const statusData = await statusResponse.json();
        if (statusResponse.status === 202) {
          const status = statusData.status === "running" ? "ComfyUI is creating the image…" : "Queued in ComfyUI…";
          setJob((current) => current ? { ...current, status } : current); onQueueRefresh(); continue;
        }
        if (!statusResponse.ok || !statusData.image?.url) { setJob((current) => current ? { ...current, error: statusData.error ?? "Image generation failed." } : current); onQueueRefresh(); return; }
        const image = `${statusData.image.url}&v=${Date.now()}`;
        setJob((current) => current ? { ...current, image, filename: statusData.image.filename ?? "HOTPROMPTER.png", status: "Image ready" } : current); onQueueRefresh(); return;
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setJob((current) => current ? { ...current, error: "HOTPROMPTER lost contact with ComfyUI. The job was not submitted again." } : current);
    } finally {
      if (generationAbortRef.current === controller) generationAbortRef.current = null;
      if (submissionSequenceRef.current === submissionSequence) setSubmitting(false);
    }
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setUploadingImage(true); setDescribeError("");
    try {
      const formData = new FormData(); formData.append("image", file);
      const response = await fetch("/api/describe-image", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) { setDescribeError(data.error ?? "Failed to describe image"); return; }
      setDraft((current) => ({ ...current, user: data.description })); setPromptSource("controls");
    } catch { setDescribeError("Failed to process image"); }
    finally { setUploadingImage(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  function loadFromNotepad() {
    try {
      const parsed = JSON.parse(notepadText);
      if (parsed.prompt || parsed.draft) { const next = JSON.parse(parsed.draft || "{}"); setDraft({ ...emptyDraft, ...next }); setPromptSource("controls"); if (hasExplicitSelections(next)) setExplicitMode(true); return; }
      if (parsed.persona || parsed.age) { setDraft({ ...emptyDraft, ...parsed }); setPromptSource("controls"); return; }
    } catch { /* Plain text is a valid prompt. */ }
    editActivePrompt(notepadText, "notepad");
  }

  function renderFieldGroup(group: (typeof GROUPS)[number]) {
    return (
      <details key={group} className="field-group" open><summary>{group}</summary>
        <div className="rotary-grid">{FIELD_DEFS.filter((field) => field.group === group).map((field) => <div key={field.key}><RotaryField id={`prompt-${field.key}`} label={field.label} value={draft[field.key]} options={field.options} onChange={(value) => { manualDraftRef.current[field.key]=value;setDraft((previous) => ({ ...previous, [field.key]: value })); setPromptSource("controls"); }} /><button type="button" className="control-pin" aria-pressed={lockedKeys.includes(field.key)} aria-label={`${lockedKeys.includes(field.key)?'Unpin':'Pin'} ${field.label}`} onClick={()=>onToggleKey(field.key)}>{lockedKeys.includes(field.key)?'Pinned':'Pin'}</button></div>)}</div>
      </details>
    );
  }

  return (
    <div className="prompt-workspace">
      {mounted && document.getElementById("provider-toolbar-slot") && createPortal(
        <div className="provider-toolbar">
          <div className="provider-toggle" aria-label="Prompt provider">
            <button type="button" className={`provider-switch ${provider === "lmstudio" ? "is-selected" : ""}`} aria-pressed={provider === "lmstudio"} disabled={!lmStudioReady} onClick={() => setProvider("lmstudio")}><span className={`dot dot--${lmStudioService?.state ?? "not-configured"}`} aria-hidden="true" />LM Studio</button>
            <button type="button" className={`provider-switch ${provider === "ollama" ? "is-selected" : ""}`} aria-pressed={provider === "ollama"} disabled={!ollamaReady} onClick={() => setProvider("ollama")}><span className={`dot dot--${ollamaService?.state ?? "not-configured"}`} aria-hidden="true" />Ollama</button>
          </div>
          <label className="provider-model-select" htmlFor="prompt-provider-model"><span className="sr-only">{providerLabel} model</span>
            <select id="prompt-provider-model" aria-label={`${providerLabel} model`} value={provider === "ollama" ? ollamaModel : lmStudioModel} onChange={(event) => provider === "ollama" ? setOllamaModel(event.target.value) : setLmStudioModel(event.target.value)}>
              {provider === "ollama"
                ? ollamaModels.map((model) => <option key={model.name} value={model.name}>{model.name}{model.details?.parameter_size ? ` · ${model.details.parameter_size}` : ""}</option>)
                : lmStudioModels.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>
        </div>,
        document.getElementById("provider-toolbar-slot") as HTMLElement
      )}
      <section className="panel-card prompt-console">
        <div className="console-title row-between">
          <div><p className="eyebrow">Prompt console</p><h2>Active prompt</h2></div>
          <span className="muted small">{providerLabel} · {provider === "ollama" ? ollamaModel : lmStudioModel}</span>
        </div>
        {providerModelsError && <p className="error-text small">Provider models: {providerModelsError}</p>}
        <label className="console-label" htmlFor="active-prompt">Active prompt <span>source: {promptSource} · {activePrompt.length} / 6000</span></label>
        <textarea id="active-prompt" className="prompt-editor" value={activePrompt} maxLength={6000} onChange={(event) => editActivePrompt(event.target.value)} placeholder="Build with the controls below or write a complete adult image prompt here." />
        <div className="console-label row-between">
          <label htmlFor="negative-prompt">Negative prompt <span>{negativeValidation.value.length} / 900</span></label>
          <div className="row-gap">
            <button type="button" className="btn btn-small" onClick={() => setNegativeLocked((current) => !current)}>{negativeLocked ? "Unlock" : "Lock"}</button>
            <button type="button" className="btn btn-small" disabled={!negativePrompt} onClick={() => copy(negativePrompt, "n")}>{copied === "n" ? "Copied!" : "Copy"}</button>
            <button type="button" className="btn btn-small" disabled={negativeLocked} onClick={() => { setNegativeCustomized(false); setNegativePrompt(buildNegativePrompt(negativeGroups, activePrompt)); }}>Rebuild</button>
          </div>
        </div>
        <textarea id="negative-prompt" className="negative-editor" value={negativePrompt} readOnly={negativeLocked} maxLength={1_200} onChange={(event) => { setNegativePrompt(event.target.value); setNegativeCustomized(true); setGenerationMode("custom"); }} placeholder="Draft mode leaves negative conditioning off for faster CPU generation." />
        {negativeValidation.notes.map((note) => <p key={note} className="muted small">{note}</p>)}
        {!negativeValidation.ok && <p className="error-text small" role="status">Shorten the negative prompt to 900 characters or fewer before queueing.</p>}
        {negativeValidation.value && requestedCfg < 2.5 && <p className="warn-text small" role="status">CFG 1 ignores negatives — this job will run at CFG 3.0.</p>}
        <div className={`prompt-health ${validation.allowed ? "is-valid" : "is-invalid"}`} role="status">
          <strong>{validation.allowed ? "Prompt valid — ready to generate" : validation.reason ?? "Prompt incomplete"}</strong>
          <span>{serverChecked ? "Checked by HOTPROMPTER server" : "Local check — use Check prompt to verify"}</span>
        </div>
        <div className="console-actions">
          <button type="button" className="btn" onClick={checkPrompt}>Check prompt</button>
          <button type="button" className="btn" disabled={!validation.allowed || enhancing || !providerReady} onClick={enhancePrompt}>{enhancing ? "Enhancing…" : `Enhance with ${providerLabel}`}</button>
          <button type="button" className="btn" onClick={() => { setPromptSource("controls"); setActivePrompt(basePrompt); setServerChecked(false); setEnhanceModel(""); }}>Rebuild from controls</button>
          <button type="button" className="btn" disabled={!activePrompt} onClick={() => copy(activePrompt, "p")}>{copied === "p" ? "Copied!" : "Copy"}</button>
          <button type="button" className="btn btn-secondary" onClick={() => { setNotepadText(activePrompt); setNotepadOpen(true); }}>Send to notepad</button>
        </div>
        {enhanceModel && <p className="ok-text small">Enhanced by {enhanceModel}</p>}
        {enhanceError && <p className="error-text">{enhanceError}</p>}
      </section>

      <div className="workbench-grid">
        <section className="panel-card stack controls-panel">
          <div className="row-between"><div><p className="eyebrow">Prompt controls</p><h2>Build with controls</h2></div><button type="button" className="btn" onClick={() => { const next=randomizeDraft();for(const key of lockedKeys)next[key]=draft[key];manualDraftRef.current={...next};setDraft(next);setPromptSource("controls"); }}>Randomize</button></div>
          <label className="check-row warn"><input type="checkbox" checked={explicitMode} onChange={(event) => { const on = event.target.checked; setExplicitMode(on); setPromptSource("controls"); if (!on) { const clean = { ...draft }; for (const key of EXPLICIT_KEYS) clean[key] = ""; setDraft(clean); } }} /><span>Enable explicit content options (18+)</span></label>
          <div className="control-groups">
            {renderFieldGroup("Render Style")}
            {renderFieldGroup("Character")}
            {renderFieldGroup("Hair")}
            <div className="control-group-stack">{renderFieldGroup("Look")}{renderFieldGroup("Technical")}</div>
            {renderFieldGroup("Scene & Action")}
            {explicitMode ? renderFieldGroup(ADULT_STYLE_GROUP) : <ReservedControlGroup label="Adult Styling & Camera" />}
            {explicitMode ? renderFieldGroup(EXPLICIT_GROUP) : <div className="explicit-space-note">Enable 18+ controls to display the Adult Explicit group here.</div>}
            {explicitMode ? renderFieldGroup(ADULT_THEME_GROUP) : <ReservedControlGroup label="Adult Theme & Personality" />}
          </div>
        </section>

        <aside className="stack config-column">
          <section className="panel-card stack-sm">
            <p className="eyebrow">Configuration</p><h2>Image engine</h2>
            <p className={comfyStatus?.ready ? "ok-text" : "muted"}>{checkingComfy ? "Checking ComfyUI…" : comfyStatus?.ready ? "ComfyUI ready" : comfyStatus?.connected ? "Online, workflow incomplete" : "ComfyUI offline"}</p>
            <small className="muted">{comfyStatus?.workflow ?? "Qwen Image 2.1 GGUF · CPU/RAM"}</small>
            {comfyStatus?.encoder && <small className="muted">Encoder: {comfyStatus.encoder.filename}{comfyStatus.encoder.warning ? " (fallback)" : ""}</small>}
            {comfyStatus?.connected && !comfyStatus.ready && comfyStatus.missing.length > 0 && <p className="error-text small">Missing: {comfyStatus.missing.join(", ")}</p>}
            <label className="field-row"><span>Square image size</span><select value={resolution} onChange={(event) => setResolution(Number(event.target.value))}><option value={512}>512 × 512 (CPU memory limit)</option></select></label>
            <label className="field-row"><span>Generation profile</span><select value={generationMode} onChange={(event) => { const value = event.target.value; if (value !== "custom") applyGenerationPreset(value as GenerationPresetId); }}>
              <option value="draft">Draft · 12 steps · CFG 1</option>
              <option value="balanced">Balanced · 20 steps · CFG 2.5</option>
              <option value="final">Final · 30 steps · CFG 3.5</option>
              {generationMode === "custom" && <option value="custom">Custom</option>}
            </select></label>
            <div className="generation-number-grid">
              <label className="field-row"><span>Steps</span><input type="number" min={8} max={50} value={steps} onChange={(event) => { setSteps(Number(event.target.value)); setGenerationMode("custom"); }} /></label>
              <label className="field-row"><span>CFG {resolvedCfgPreview !== requestedCfg ? <em>→ {resolvedCfgPreview.toFixed(1)}</em> : null}</span><input type="number" min={1} max={6} step={0.1} value={requestedCfg} onChange={(event) => { setRequestedCfg(Number(event.target.value)); setGenerationMode("custom"); }} /></label>
            </div>
            <fieldset className="negative-groups" disabled={negativeLocked}>
              <legend>Negative groups</legend>
              {([
                ["qualityFloor", "Quality floor"],
                ["anatomy", "Anatomy"],
                ["text", "Text / watermark"],
                ["artifacts", "Artifacts"]
              ] as Array<[keyof NegativeGroups, string]>).map(([key, label]) => <label className="check-row" key={key}><input type="checkbox" checked={negativeGroups[key]} onChange={(event) => updateNegativeGroup(key, event.target.checked)} /><span>{label}</span></label>)}
            </fieldset>
            <label className="field-row"><span>Seed (blank = random)</span><input inputMode="numeric" pattern="[0-9]*" value={seed} onChange={(event) => setSeed(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Random" /></label>
            <button type="button" className="btn" onClick={randomizeSeed}>New random seed</button>
            <button type="button" className="btn btn-secondary" onClick={checkComfyUI} disabled={checkingComfy}>{checkingComfy ? "Checking…" : "Refresh engine"}</button>
          </section>
          <section className="panel-card stack-sm">
            <p className="eyebrow">Image to prompt</p><h2>Describe image</h2>
            <p className="muted small">Use a local vision model to create a starting point.</p>
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} hidden id="image-upload" />
            <label htmlFor="image-upload" className="btn btn-secondary">{uploadingImage ? "Describing image…" : "Upload image"}</label>
            {describeError && <p className="error-text">{describeError}</p>}
          </section>
          <PresetsPanel draft={draft} validationAllowed={validation.allowed} onLoad={(loaded) => { setDraft({ ...emptyDraft, ...loaded }); setPromptSource("controls"); if (hasExplicitSelections(loaded)) setExplicitMode(true); }} />
        </aside>
      </div>

      <div className="sticky-bottom-action utility-dock">
        <button type="button" className="btn btn-primary generate-button" disabled={!validation.allowed || !negativeValidation.ok || submitting || !comfyStatus?.ready} onClick={()=>void generateImage()}>{submitting ? "Adding to queue…" : queueHasJobs || latestJobActive ? "Queue another image" : "Generate image"}</button>
        <button type="button" className="btn" onClick={() => setJobOpen(true)}><span className={`memory-led ${latestJobActive ? "is-live" : ""}`} aria-hidden="true" />Latest image job</button>
        <button type="button" className="btn" onClick={() => setNotepadOpen(true)}>Notepad</button>
        <p className="dock-note">Image jobs run independently. Keep editing while ComfyUI works.</p>
      </div>

      {mounted && createPortal(<>
        <ImageJobDrawer open={jobOpen} onClose={() => setJobOpen(false)} job={job} running={latestJobActive} onReuseSeed={(value) => setSeed(String(value))} />
        <Notepad open={notepadOpen} onClose={() => setNotepadOpen(false)} text={notepadText} onChange={setNotepadText} onLoad={() => { loadFromNotepad(); onShowPrompt(); }} onCopy={() => copy(notepadText, "np")} copied={copied === "np"} />
      </>, document.body)}
    </div>
  );
}
