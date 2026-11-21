# HOTPROMPTER UI designer handoff

## Latest status and documentation

The source dashboard now has four tabs: Hotprompter, Engine Room, Gallery, and Preset Library. The root `README.md` is the current configuration/workflow/status reference and lists unresolved work explicitly. Preserve the legacy saved-prompt panel and APIs alongside the new schema-2 library.

New immutable records and mark/notes sidecars are stored under `.data`; these are local application data, excluded from Git. Capture provenance at submission, read recorded attribution in Gallery, and never fill missing historical attribution from the live panel. Some extended library ideas remain pending as listed in README; do not portray them as implemented.

## Generation controls update

New submissions default to Draft (12 steps, CFG 1, negative off). Balanced uses 20 steps / CFG 2.5 / quality negatives; Final uses 30 steps / CFG 3.5 / all negative groups. These settings are separate from saved prompt-library presets. Preserve editable steps, CFG, and seed; blank seed means random.

Negative text is deterministic and editable, with Copy, Lock/Unlock, Rebuild, and four group switches. Lock prevents editing and group-driven rebuilds. Selecting a generation profile explicitly replaces negative settings and unlocks the editor. The server resolves non-empty negatives requested below CFG 2.5 to CFG 3, and empty negatives to CFG 1. Show the resolved value; CPU cost estimates are not measured.

The installed Qwen conditioning node uses `prompt` and `negative_prompt` in one node, returning positive and negative conditioning. Preserve this live contract. Each accepted job includes a frozen SHA-256 snapshot, seed, steps, resolved CFG, negative text, dimensions, sampler, scheduler, and denoise. PNG metadata receives `extra_pnginfo.hotprompter`; filenames include the hash prefix. Poll by unique ComfyUI prompt ID. Gallery reads actual workflow settings, including legacy outputs, and offers Reuse seed, which returns to Hotprompter without submitting.

## Purpose

Redesign the existing local-only prompt-to-image dashboard without replacing its working backend. The product builds adult-only image prompts, optionally enhances them with locally hosted language models, submits image jobs to local ComfyUI, and displays the finished image.

The graphical implementation may be replaced or merged later, but the API contracts and safety behavior in this repository remain the source of truth.

## Existing stack

- Next.js 14 App Router, React 18, TypeScript.
- Route Handlers under `app/api` keep model URLs and environment variables server-side.
- SQLite and Prisma store prompt presets locally.
- LM Studio supplies the current prompt-enhancement model.
- LM Studio and Ollama are active local prompt-enhancement providers.
- Ollama model selection is populated from its server-side local model inventory.
- The preferred default prompt model is `goonsai/qwen2.5-1.5B-goonsai-nsfw-10k:latest` through Ollama; users may still choose another online local model.
- ComfyUI performs image generation and saves images locally.
- No cloud AI, cloud storage, analytics, telemetry, remote fonts, CDNs, or externally hosted UI assets.

## Functional model

### 1. Local service identity

The top-level dashboard must make the local system state visible at a glance:

- HOTPROMPTER: online/offline.
- LM Studio: online, degraded, or offline; show the selected local model.
- Ollama: show online, degraded, or offline plus the selected installed local model.
- ComfyUI: ready, generating, degraded, or offline.
- Persistent text label: `Local AI workspace · No cloud processing`.

Never communicate state by color alone. Every status dot must have a text label and accessible name.

### 2. Prompt-provider rollout

Current release:

- LM Studio is the only usable prompt provider.
- The interface identifies the selected provider and model and whether that provider is online.
- `POST /api/enhance-prompt` accepts the backward-compatible draft plus optional `provider`, `model`, and manually edited `prompt` fields.

Current Ollama integration:

- Discover locally installed Ollama models through the server-side `/api/tags` adapter.
- Let the user select LM Studio or Ollama, followed by a model available from that provider.
- Keep provider URLs server-side and keep browser requests same-origin.
- Enable Ollama only when its server is online and an installed model is selected.

Possible future implementation keys:

```ts
type PromptProviderId = "lmstudio" | "ollama";

type PromptProviderChoice = {
  provider: PromptProviderId;
  model: string;
};
```

Supporting both providers simultaneously is not part of the current release. If parallel comparison is added later, preserve provider/model attribution and never silently blend or overwrite outputs.

### 3. Image queue

Show three live counts:

- Running.
- Waiting.
- Total.

Each job row contains:

- Explicit state text: running or waiting position.
- Short prompt preview.
- Resolution when available.
- Short job ID for identification.
- `Cancel` action for that job only.

Do not offer a visually dominant `clear all` action. Cancelling must target one job and must never automatically retry or replay it.

Current local APIs:

```text
GET    /api/dashboard-status
GET    /api/image-queue
DELETE /api/image-queue       body: { "promptId": "..." }
```

`GET /api/dashboard-status` returns:

```ts
type DashboardStatusResponse = {
  localOnly: true;
  generatedAt: string;
  services: Array<{
    id: "hotprompter" | "lmstudio" | "ollama" | "comfyui";
    label: string;
    state: "online" | "offline" | "degraded" | "not-configured";
    detail: string;
  }>;
  queue: {
    running: number;
    pending: number;
    total: number;
    jobs: Array<{
      promptId: string;
      state: "running" | "pending";
      position: number;
      promptPreview: string;
      width: number | null;
      height: number | null;
      seed: number | null;
      createdAt: string | null;
    }>;
  };
};
```

Poll this same-origin endpoint about every five seconds. Do not connect the browser directly to ComfyUI or either model server.

### 4. Prompt library

Saved prompts and image jobs are different objects. Do not combine them into one list.

Existing local preset APIs:

```text
GET    /api/presets
POST   /api/presets            body: { "name": "...", "draft": { ... } }
DELETE /api/presets/:id
```

Each saved prompt card or row requires:

- Name and saved date.
- Prompt preview.
- `Load` action.
- `Delete` action with a compact confirmation step.
- A clear `Save current prompt` form to add a new entry.

Loading a preset updates the editor only; it must not automatically enhance, generate, or enqueue an image. Deleting a saved prompt must not cancel a queued image job.

### 5. Generation lifecycle

Use explicit, truthful states:

```text
Draft → Validating → Enhancing → Ready → Queued → Running → Decoding → Saving → Complete
                                                              ↘ Failed / Cancelled
```

Do not label prompt enhancement as image completion. A PNG only exists after ComfyUI reaches its Save Image node. Long CPU generations may take tens of minutes, so retain the job ID and queue state when the browser is refreshed.

### 6. Privacy and local-only rules

- Browser code calls only same-origin `/api/...` routes.
- AI server URLs remain server-only environment variables; never prefix them with `NEXT_PUBLIC_`.
- Accept only loopback, LAN, private IPv4/IPv6, `.local`, `.lan`, single-label LAN names, or the `100.64.0.0/10` private overlay range.
- Do not add OpenAI, Anthropic, Google, hosted inference, cloud storage, analytics, telemetry, remote error reporting, remote fonts, or CDN assets.
- Uploaded images remain in memory only for the local vision request unless the user explicitly saves them.
- Do not send prompt text, generated images, model names, filenames, or usage data outside the private network.

## Merge boundaries

The designer may replace:

- `app/page.tsx` presentation and component composition.
- `app/dashboard-status.tsx` markup and visual treatment.
- `app/presets-panel.tsx` presentation.
- `app/globals.css` and new local CSS modules.

The designer must preserve or deliberately adapt:

- All `app/api/**` route contracts.
- `lib/dashboard-contract.ts` stable types.
- Adult confirmation and server-side prompt validation.
- Explicit-content mode behavior.
- Same-origin API calls and local-only URL enforcement.
- Queue cancellation by individual prompt ID.
- No automatic resubmission after a timeout, disconnect, or uncertain state.

No backend route, database schema, model URL, model ID, workflow node, or safety validation should be changed merely to fit a visual mockup.

## Copy-ready prompt for a UI coding designer

```text
Redesign the existing HOTPROMPTER dashboard as a production-ready, responsive Next.js 14 App Router interface. This is a private local-AI workstation, not a cloud SaaS product. Preserve the existing backend, API contracts, safety validation, and local-only processing. Produce code-native React/TypeScript UI that can be merged into the existing repository; do not produce a static screenshot and do not rewrite backend routes.

Product workflow:
1. The user confirms they are an adult.
2. The user builds an image prompt using grouped fields, randomization, image-to-prompt, and a notepad.
3. The user validates the prompt locally.
4. The user selects LM Studio or Ollama for prompt enhancement. Show the selected provider, online state, and model attribution.
5. The user submits the selected prompt to local ComfyUI.
6. The dashboard displays truthful queued/running/decoding/saving/complete states, live queue counts, individual queue rows, and a per-job Cancel action.
7. Finished images appear in a viewer with a local PNG download action.
8. The user can save the current prompt, load saved prompts, and delete saved prompts with confirmation. Loading never automatically generates. Deleting a saved prompt never cancels an image job.

Required primary screen regions:
- Compact top status rail: “Local AI workspace · No cloud processing”; HOTPROMPTER, LM Studio, Ollama, and ComfyUI statuses; running/waiting/total image counts.
- Left editor region: grouped prompt controls, adult mode, image-to-prompt, randomize, and validation.
- Main result region: base prompt, LM Studio enhanced prompt with model attribution, negative prompt, copy controls, and local notepad.
- Image generation region: ComfyUI workflow identity, image size, queue/generation state, generated image viewer, and download.
- Prompt library: saved prompt rows with Save current, Load, and Delete.
- Expandable image queue: prompt preview, resolution, short job ID, state, position, and per-job Cancel.

Visual direction:
- A calm, capable local creative workstation rather than a generic admin template.
- Strong information hierarchy, restrained dark or neutral surfaces, excellent typography, accessible contrast, and generous but efficient spacing.
- Status colors may use green/amber/red/gray, always paired with text and icons; never rely on color alone.
- Avoid neon cyberpunk clichés, excessive gradients, glassmorphism, bento-card repetition, decorative metrics, fake charts, marketing hero sections, cloud imagery, and filler copy.
- Use open panels, rails, lists, and a focused image canvas. Avoid wrapping every control in a separate rounded card.
- Desktop should support a productive two- or three-region layout. Mobile should become a clear single-column task flow without horizontal scrolling.
- Respect prefers-reduced-motion. Provide visible keyboard focus, semantic labels, aria-live status updates, and minimum 44px touch targets.

Technical constraints:
- Existing stack: Next.js 14 App Router, React 18, TypeScript, plain CSS currently, Prisma/SQLite locally.
- All browser requests must be same-origin /api calls.
- Do not expose AI service URLs in client code or NEXT_PUBLIC variables.
- Do not add any cloud AI SDK, analytics, telemetry, hosted storage, remote font, CDN, or external asset request.
- Use GET /api/dashboard-status every ~5 seconds for service and queue status.
- Use GET and DELETE /api/image-queue for queue display and single-job cancellation.
- Preserve GET/POST /api/presets and DELETE /api/presets/:id.
- Preserve current prompt, enhancement, generation, image-viewer, and validation routes.
- Treat saved prompts and queued image jobs as distinct data types.
- Never report a timeout as success and never automatically replay an uncertain image request.

Deliver:
1. A component map and design-token list before code.
2. Desktop and mobile implementations.
3. Components with explicit ownership: AppShell, LocalStatusRail, CurrentProvider, PromptEditor, EnhancedPrompt, GenerationPanel, ImageQueue, ImageViewer, and PromptLibrary.
4. Loading, empty, offline, degraded, running, cancelled, failed, and complete states.
5. A short integration note listing files changed and confirming that no cloud request or backend contract was added.

Use realistic local states and the exact labels above. Do not invent cloud accounts, subscriptions, login flows, teams, billing, public sharing, or remote galleries.
```

## Acceptance checklist

- Queue counts match the local ComfyUI queue.
- One queue job can be cancelled without clearing or replaying other jobs.
- Saved prompts can be added, loaded, and deleted independently.
- Completed HOTPROMPTER images can be deleted only after confirmation and only from the configured local ComfyUI output root.
- LM Studio and Ollama are independently identifiable and selectable only while online.
- Ollama model selection lists installed local models and never exposes or accepts a browser-supplied server URL.
- Offline and not-configured are visually distinct.
- Image generation is not marked complete before a saved image is returned.
- Refreshing the browser does not enqueue a duplicate image.
- All AI and image traffic remains on loopback, LAN, or the private overlay network.
- Keyboard, screen-reader, reduced-motion, desktop, and mobile paths are usable.

## November 2026 analogue-workstation prototypes

The current visual direction is captured in three separate, reviewable images:

- `design-prototypes/tab-1-hotprompter.png` — editable prompt console, controls/configuration workbench, image-job drawer, and ten-slot local notepad.
- `design-prototypes/tab-2-engine-room.png` — ideal operations view with a frozen submitted prompt, workflow stages, queue, model/device attribution, and readiness diagnostics.
- `design-prototypes/tab-3-gallery.png` — proposed local image library with filters and an image inspector.

Treat these as visual targets, not evidence that every pictured capability exists. In particular:

- Only display exact sampling steps or percentage when ComfyUI exposes truthful progress data. Otherwise show the current known lifecycle stage or an indeterminate running state.
- The Gallery filters, favourites, output-folder action, and expanded metadata are proposed additions and require explicit backend support before implementation. Confirmed deletion is implemented.
- Current completion remains defined by a ComfyUI history result containing a saved `SaveImage` output.
- The submitted prompt shown for a running image is an immutable job snapshot; editing the active prompt must not alter it.
