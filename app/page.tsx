"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { LocalStatusRail, useDashboardStatus } from "./components/status";
import { HotprompterPanel } from "./components/hotprompter";
import { EngineRoomPanel } from "./components/engine-room";
import { GalleryPanel } from "./components/gallery";
import { PresetLibraryPanel } from "./components/preset-library";
import type { LibraryPreset } from "@/lib/preset-library";
import { emptyDraft, type Draft } from "@/lib/options";
import type { PanelRequest } from "./components/job-detail";

type TabId = "hotprompter" | "engine" | "gallery" | "library";
const TABS: Array<{ id: TabId; label: string }> = [
  { id: "hotprompter", label: "Hotprompter" },
  { id: "engine", label: "Engine Room" },
  { id: "gallery", label: "Gallery" },
  { id: "library", label: "Preset Library" }
];

export default function Page() {
  const { status, error, refresh } = useDashboardStatus();
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [tab, setTab] = useState<TabId>("hotprompter");
  const [seedRequest, setSeedRequest] = useState<{ value: number; nonce: number } | null>(null);
  const [currentDraft,setCurrentDraft]=useState<Draft>(emptyDraft);
  const [currentPrompt,setCurrentPrompt]=useState("");
  const [stack,setStack]=useState<LibraryPreset[]>([]);
  const [composition,setComposition]=useState<{stack:LibraryPreset[];resetManual:boolean;nonce:number}|null>(null);
  const [lockedKeys,setLockedKeys]=useState<string[]>([]);
  const [panelRequest,setPanelRequest]=useState<PanelRequest|null>(null);
  const toggleKey=(key:string)=>setLockedKeys(current=>current.includes(key)?current.filter(value=>value!==key):[...current,key]);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = TABS.length - 1;
    else return;

    event.preventDefault();
    setTab(TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  if (!confirmedAdult) {
    return (
      <main key="adult-gate" className="adult-check app-shell">
        <div className="adult-card panel-card">
          <p className="eyebrow">Local-only prompt workspace</p>
          <h1>Hotprompter</h1>
          <p className="muted">Local personal-use tool. All characters composed or viewed here must be consenting adults (18+).</p>
          <label className="check-row">
            <input type="checkbox" onChange={(event) => setConfirmedAdult(event.target.checked)} />
            <span>I confirm I am 18 years or older.</span>
          </label>
        </div>
      </main>
    );
  }

  return (
    <main key="dashboard" className="app-shell">
      <LocalStatusRail status={status} error={error} />
      <div className="tab-shell" role="tablist" aria-label="Dashboard tabs" aria-orientation="horizontal">
        {TABS.map((t, index) => (
          <button
            key={t.id}
            ref={(element) => { tabRefs.current[index] = element; }}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={`tab-btn ${tab === t.id ? "is-active" : ""}`}
            onClick={() => setTab(t.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {t.label}
          </button>
        ))}
        <div id="provider-toolbar-slot" className="provider-toolbar-slot" aria-label="Global prompt provider controls" />
      </div>

      <section id="panel-hotprompter" role="tabpanel" aria-labelledby="tab-hotprompter" hidden={tab !== "hotprompter"} className="tab-panel">
        <HotprompterPanel dashboardStatus={status} onQueueRefresh={refresh} onShowPrompt={() => setTab("hotprompter")} seedRequest={seedRequest} onDraftChange={setCurrentDraft} onPromptChange={setCurrentPrompt} composition={composition} lockedKeys={lockedKeys} onToggleKey={toggleKey} presetStack={stack} panelRequest={panelRequest} onClearStack={()=>setStack([])} onRestoreStack={setStack} />
      </section>
      <section id="panel-engine" role="tabpanel" aria-labelledby="tab-engine" hidden={tab !== "engine"} className="tab-panel">
        <EngineRoomPanel active={tab === "engine"} status={status} onRefreshStatus={refresh} />
      </section>
      <section id="panel-gallery" role="tabpanel" aria-labelledby="tab-gallery" hidden={tab !== "gallery"} className="tab-panel">
        <GalleryPanel active={tab === "gallery"} onReuseSeed={(value) => { setSeedRequest({ value, nonce: Date.now() }); setTab("hotprompter"); }} currentPrompt={currentPrompt} onPanelRequest={(request)=>{setPanelRequest(request);setTab('hotprompter')}} />
      </section>
      <section id="panel-library" role="tabpanel" aria-labelledby="tab-library" hidden={tab!=="library"} className="tab-panel">
        <PresetLibraryPanel active={tab==='library'} draft={currentDraft} stack={stack} lockedKeys={lockedKeys} onToggleKey={toggleKey} onOpenPanel={()=>setTab('hotprompter')} onApply={(next,resetManual=false)=>{setStack(next);setComposition({stack:next,resetManual,nonce:Date.now()})}} />
      </section>
    </main>
  );
}
