# HOTPROMPTER

HOTPROMPTER is a local-only prompt workstation that turns structured controls and manually edited text into image-generation jobs. Text enhancement can use LM Studio or Ollama, while all image generation is sent to ComfyUI.

The latest source dashboard has four tabs (updated 10 November 2026):

- **Hotprompter** — build, enhance, inspect, edit, save, and submit prompts.
- **Engine Room** — inspect provider readiness and the ComfyUI queue, and cancel one job at a time.
- **Gallery** — view, download, and permanently delete completed HOTPROMPTER images.
- **Preset Library** — scoped composition, forks, import quarantine, variants, and lineage. This is separate from the legacy saved-prompt panel.

## Latest change summary and verification

| Area | Latest change | Evidence / remaining verification |
| --- | --- | --- |
| Prompt workflow | Compose/edit while ComfyUI runs; submit additional queue jobs | Previously checked with a running engine; submissions use frozen snapshots |
| Negative conditioning | Draft/Balanced/Final, editable/lockable negatives, resolved CFG | Unit, API-mocked and prior browser checks passed; new image-quality comparisons pending |
| CPU hardening | 512 cap, preview-free launch profiles, encoder selection/fallback, shared model discovery | Focused mocked tests passed; next-launch flags and cold-start RSS not benchmarked |
| Preset Library | Schema-2 scoped owns/option IDs, manual priority, pins, forks, variants, import quarantine, soft trash | Ownership/checksum/merge/fork tests passed; browser capture/compose/reset and desktop/mobile checks passed |
| Gallery provenance | Capture-time attribution, sidecar marks/notes, reuse/diff, scoped promotion, JSON export | Frozen-byte and ranking-threshold tests passed; browser marks/notes/diff-seed checks passed with intercepted writes |

The latest production build is activated on port 3002. Browser mutations were intercepted during QA, so these checks did not enqueue images or alter the real preset library. Live ComfyUI image-quality and memory benchmarks remain pending. Read the open-issues section before treating a performance target as accepted.

No browser request connects directly to LM Studio, Ollama, or ComfyUI. The browser uses same-origin `/api/*` routes and the server keeps all service URLs private.

## Current local configuration

| Service | Address | Purpose |
| --- | --- | --- |
| HOTPROMPTER | `http://127.0.0.1:3002` | Next.js dashboard and API |
| ComfyUI | `http://127.0.0.1:8188` | CPU/RAM-first image generation |
| LM Studio | `http://100.122.52.80:1234` | Optional prompt enhancement |
| Ollama | `http://127.0.0.1:11434` | Preferred prompt enhancement |

Port `3010` is intentional because port `3000 - 3009` is already used by Docker Desktop on this machine.

Preferred prompt model:

```text
goonsai/qwen2.5-1.5B-goonsai-nsfw-10k:latest
```

Current ComfyUI model files:

```text
UNet: qwen-image-2.1-UC-Q4_K_M.gguf
CLIP: qwen3vl_8b_int8_convrot.safetensors
VAE:  qwen_image_2.1_vae_bf16.safetensors
```

| Role | Current file location | Approximate disk size |
| --- | --- | --- |
| Image diffusion model | `D:\models\abenzerps\Qwen-Image-2.1-Uncensored-Quantized\qwen-image-2.1-UC-Q4_K_M.gguf` | 4.60 GB |
| Qwen3-VL text encoder | `D:\models\comfyui\text_encoders\qwen3vl_8b_int8_convrot.safetensors` | 9.35 GB |
| Qwen Image VAE | `D:\models\comfyui\vae\qwen_image_2.1_vae_bf16.safetensors` | 0.68 GB |

GoonsAI in Ollama enhances **text**. It does not generate the image and is separate from the Qwen3-VL encoder in ComfyUI. LM Studio's currently configured alternative is `gemma-4-e2b-uncensored-hauhaucs-aggressive-q4_k_p`. A Q4 replacement for the **text encoder** is not yet installed or accepted.

The configured ComfyUI output folder is:

```text
D:\ComfyUI_windows_portable\ComfyUI\output
```

## Requirements

- Windows and PowerShell
- Node.js with `npm.cmd`
- The portable ComfyUI installation at `D:\ComfyUI_windows_portable`
- The configured Qwen Image model files available to ComfyUI
- At least one local text provider: Ollama or LM Studio
- SQLite; Prisma manages the local preset database

The application is designed for local/private services. Cloud AI, telemetry, and remote browser assets are not required.

## Environment configuration

The working configuration is stored in `D:\HOTPROMPTER\.env`:

```dotenv
DATABASE_URL="file:./dev.db"
ALLOW_EXPLICIT=true

LM_STUDIO_URL="http://100.122.52.80:1234"
LM_STUDIO_PROMPT_MODEL="gemma-4-e2b-uncensored-hauhaucs-aggressive-q4_k_p"

OLLAMA_URL="http://127.0.0.1:11434"
OLLAMA_PROMPT_MODEL="goonsai/qwen2.5-1.5B-goonsai-nsfw-10k:latest"

COMFYUI_URL="http://127.0.0.1:8188"
COMFYUI_OUTPUT_DIR="D:\\ComfyUI_windows_portable\\ComfyUI\\output"
COMFYUI_UNET_MODEL="qwen-image-2.1-UC-Q4_K_M.gguf"
COMFYUI_CLIP_MODEL="qwen3vl_8b_int8_convrot.safetensors"
COMFYUI_VAE_MODEL="qwen_image_2.1_vae_bf16.safetensors"
```

Service URLs are validated server-side and must remain local/private AI endpoints. Restart HOTPROMPTER after changing `.env`.

## Install and initialise

From PowerShell:

```powershell
Set-Location D:\HOTPROMPTER
npm.cmd install
npm.cmd run db:generate
npm.cmd run db:push
```

`db:push` creates or updates the local SQLite database used by the prompt library.

## Start the project

Start ComfyUI in one PowerShell window:

```powershell
Set-Location D:\ComfyUI_windows_portable
.\python_embeded\python.exe -s ComfyUI\main.py --cpu --windows-standalone-build --listen 127.0.0.1 --port 8188 --use-pytorch-cross-attention --preview-method none
```

For development, start HOTPROMPTER in another window:

```powershell
Set-Location D:\HOTPROMPTER
npm.cmd run dev
```

Then open `http://127.0.0.1:3002`.

For a production run:

```powershell
Set-Location D:\HOTPROMPTER
npm.cmd run build
npm.cmd run start
```

LM Studio and Ollama are independent services. Start either or both before selecting them in the provider/model controls.

## CPU performance configuration

This pass targets 32 GB RAM, 4 GB VRAM, NVMe model storage, and a maximum output of 512 × 512. The UI offers 512 only and the server caps each requested dimension at 512. Existing submitted workflows keep their original settings.

The current engine was launched with `--cpu`: sampling and VAE decode both execute on CPU. It is not a measured hybrid CPU/GPU run. The progress observer never requests or decodes latent previews. New launches explicitly disable previews.

From `D:\HOTPROMPTER`, the guarded launcher starts ComfyUI in a hidden window and records logs in `.runtime`. It returns without restarting an engine that is already online:

```powershell
.\scripts\start-comfyui.ps1 -Profile cpu
# Alternative GPU-capable low-VRAM profile, after the current engine is stopped:
.\scripts\start-comfyui.ps1 -Profile lowvram
```

The machine's current PowerShell execution policy blocked the unsigned launcher during verification. No execution policy was changed. Use the inline CPU command in **Start the project**, or have the launcher signed/approved under your Windows policy before running it.

CPU uses `--cpu --use-pytorch-cross-attention --preview-method none`. The alternative replaces `--cpu` with `--lowvram --reserve-vram 0.5`. Both preserve smart memory. `--cpu` and `--lowvram` are mutually exclusive. Low-VRAM mode permits GPU use; it does not guarantee CPU sampling or GPU-only VAE decode. In this ComfyUI version, dynamic VRAM can also supersede `--lowvram`. Benchmark the actual device placement before adopting that profile. These scripts do not change `extra_model_paths.yaml` or alter an existing queue.

Encoder names are centralized in `lib/comfy-config.ts`. Optional server settings:

```dotenv
COMFYUI_CLIP_Q4_MODEL=""
COMFYUI_CLIP_FALLBACK_MODEL="qwen3vl_8b_int8_convrot.safetensors"
```

Leave Q4 blank until a compatible Qwen Image 2.1 text encoder is available. Once sourced, put it in an already registered text-encoder directory and set its exact ComfyUI inventory name. A `.gguf` encoder uses the installed `CLIPLoaderGGUF`; safetensors uses `CLIPLoader` with `device: cpu`. Readiness and each new submission recheck ComfyUI's inventory. An absent preferred file or unsupported GGUF loader selects INT8 fallback and logs a warning once per fallback transition. Neither file available returns a clear error before enqueueing. A corrupt but listed file cannot be detected by inventory alone; execution errors are not automatically replayed.

The selected encoder, loader, UNet and VAE names are included in new snapshot hashes and PNG metadata, so a fallback cannot silently masquerade as a Q4 run. Names are recorded; model-file content hashes are not yet calculated. No compatible Q4 file has been installed or benchmarked in this pass; the proposed ~10 GB resident-memory target is unverified.

Ollama uses repeat penalty 1.05 and 140 predicted tokens. Model discovery warms asynchronously at server startup, shares one in-flight request across routes, and refreshes after a 60-second TTL. Dashboard/model/enhancement routes use the same cache. An offline provider does not prevent startup, and failures are retried on the next request. Discovery caching may delay an online/offline change for up to 60 seconds.

### Manual Windows pagefile setting

The requested fixed-size configuration is **64 GB on NVMe**: open Advanced system settings → Performance Settings → Advanced → Virtual memory → Change. Uncheck automatic management, select the intended NVMe volume, choose Custom size, and set both Initial and Maximum size to **65536 MB**. Click Set and apply; Windows may require a restart. Check sufficient free disk space before doing this. This is manual documentation only; this project does not change Windows virtual-memory settings. A fixed pagefile prevents dynamic file growth but does not prevent paging or guarantee faster generation.

See `PERFORMANCE_ACCEPTANCE.md` for the corrected image-comparison and memory-measurement checks still requiring a controlled live run.

## Prompt workflow

```text
Controls / typed prompt / composed presets
  → HOTPROMPTER validation
  → optional Ollama → GoonsAI Qwen 2.5 1.5B
       (or LM Studio → configured Gemma model)
  → enhanced text returns to the active editor
  → server validates positive + normalizes negative
  → resolve CFG, dimensions, seed, steps and actual encoder
  → freeze/hash snapshot + provenance; save immutable local record
  → ComfyUI accepts a unique prompt ID
  → model loading / text encoding → sampling → VAE decode → SaveImage
  → HOTPROMPTER image proxy → viewer / Gallery
```

Enhancement is optional. Manual text can go directly from HOTPROMPTER validation to ComfyUI.

1. Choose structured controls in the Hotprompter tab.
2. Edit the active and negative prompts directly at any time.
3. Select Ollama or LM Studio and an available model.
4. Optionally enhance or check the prompt.
5. Submit the current prompt to ComfyUI.
6. Continue composing the next prompt while the submitted image job runs.
7. Use **Queue another image** to add the next prompt behind the running job.
8. Inspect every running/pending job in Engine Room and completed output in Gallery.

Submitting a job captures an immutable prompt snapshot. Later edits do not silently alter an already queued or running image. The Image Job drawer follows the newest submission; Engine Room remains the authoritative view of all running and pending jobs.

The Notepad and Image Job drawers are separate. Notepad content and numbered memory slots `1`–`9` and `0` persist in browser local storage.

## Provider and model controls

- Ollama is the preferred provider and defaults to the configured GoonsAI Qwen model when available.
- LM Studio remains selectable and lists models returned by its local OpenAI-compatible API.
- The toolbar displays provider availability and the currently selected model.
- Candidate prompts preserve provider/model attribution and are never silently merged.
- The existing server-side prompt validation applies after local model enhancement.
- Ollama and LM Studio share the persona from `lib/enhancer-persona.ts`. LM Studio allows 180 output tokens; Ollama allows 140 with repeat penalty 1.05. Ollama model discovery is cached for 60 seconds within each server process.

The model lists come from `GET /api/prompt-models`; the older Ollama-only list remains available at `GET /api/ollama-models`.

The shared enhancer persona preserves stated subjects, ages and intent, discourages invented major details, treats source text as content rather than role instructions, and requests a single plain-text prompt. Server validation still runs before and after enhancement. The Ollama output-token setting limits the model response; current source-preservation post-processing can prepend the original prompt, so the final returned text can be longer than 140 tokens.

## Control and sampling options

| Area | Available controls |
| --- | --- |
| Render / subject | Art style, persona, species, adult age, character attributes |
| Character / hair | Heritage, build, eye color, features, hair color/texture/length/style |
| Look | Outfit and mood |
| Scene / action | Location, action/pose, background, expression |
| Technical | Lighting and camera/framing |
| Generation | 512 square output, profile, 8–50 steps, requested CFG 1–6, random or captured 32-bit seed |
| Negative | Quality, anatomy, text/watermark, artifacts; manual text, lock, rebuild and copy |
| Workspace | Notepad, numbered local memories, saved prompts, new scoped preset stack, pinned controls |

`lib/options.ts` is the current option catalog. Original category notes in `design-prototypes/catagories.txt` are references, not automatically active settings. Existing adult-gated fields retain their existing validator; the subsequently proposed graphic explicit-zone expansion and 768 minimum are not implemented.

## Installed ComfyUI graph

| Node | Class | Job |
| --- | --- | --- |
| 1 | `UnetLoaderGGUF` | Qwen Image 2.1 diffusion model |
| 2 | `CLIPLoader` or configured `CLIPLoaderGGUF` | Selected encoder, checked against inventory |
| 3 | `VAELoader` | Qwen Image 2.1 VAE |
| 4 | `TextEncodeQwenImage21` | Both `prompt` and `negative_prompt`; output 0 positive, output 1 negative |
| 5 | `EmptyLatentImage` | Width/height, batch size 1 |
| 6 | `QwenImage21Cache` | `device: off`, `dtype: int8` |
| 7 | `KSampler` | Euler / simple / denoise 1, frozen seed/steps/resolved CFG |
| 8 | `VAEDecode` | Latents to pixels |
| 9 | `SaveImage` | `HOTPROMPTER_<hash prefix>` output plus PNG metadata |

This installed conditioning node is not the two-node `text:` example in the supplied work order. Node 5 remains the latent node. Cache `off` rules out the KV cache and recomputes work; its INT8 setting does not mean a persistent INT8 cache is currently active. Benchmark alternatives before claiming a cache speed improvement.

## Image jobs and progress

Generation profiles apply to new submissions only:

| Profile | Steps | CFG | Negative conditioning |
| --- | --- | --- | --- |
| Draft (default) | 12 | 1 | Off |
| Balanced | 20 | 2.5 | Quality floor |
| Final | 30 | 3.5 | Quality, anatomy, text, and artifacts |

Steps, CFG, and seed can be edited. A blank seed generates and records a random seed. Negative text can be edited, copied, locked, or rebuilt from deterministic Chinese-language term groups. Their quality advantage has not been benchmarked on this machine. The builder's 70-token budget is an estimate, not tokenizer enforcement.

The server normalizes negative text, limits it to 40 terms and 900 characters, and resolves CFG: an empty negative uses CFG 1; a non-empty negative requested below CFG 2.5 runs at CFG 3. The installed `TextEncodeQwenImage21` accepts both text strings and returns both conditioning outputs from one node. Guidance above 1 requires additional model work, so Balanced and Final can be substantially slower on CPU.

Each accepted job captures seed, steps, resolved CFG, positive and negative text, sampler, scheduler, denoise, dimensions, and a SHA-256 content hash. ComfyUI receives the snapshot through `extra_pnginfo.hotprompter`; filenames start with `HOTPROMPTER_<8-character hash>`. History polling still uses ComfyUI's unique prompt ID. The drawer and Gallery expose job settings and seed reuse. Reusing a seed alone does not reproduce an image unless the other settings and model files also match.

HOTPROMPTER submits an API-format workflow to ComfyUI and tracks it through ComfyUI queue, history, and progress events.

Job state is deliberately conservative:

- **queued** — accepted but waiting
- **running** — ComfyUI is executing the workflow
- **decoding/saving** — the workflow has reached its output stages when that evidence is available
- **complete** — ComfyUI history contains a `SaveImage` output
- **failed/cancelled** — ComfyUI reports an error or the selected job is cancelled

A successful HTTP submission is not considered a completed image. Completion requires a saved output returned by ComfyUI history.

Engine Room supports per-job cancellation only. It does not clear the full queue, auto-retry jobs, or change model/service environment variables from the browser.

## Gallery and output safety

Gallery reads completed `HOTPROMPTER*.png` outputs from ComfyUI history and serves them through the same-origin image proxy.

- Download is local and does not upload the image.
- Delete requires confirmation and is permanent.
- Delete accepts only validated HOTPROMPTER PNG filenames under `COMFYUI_OUTPUT_DIR`.
- Absolute paths, traversal attempts, other extensions, and files outside the configured output root are rejected.

## Prompt library and local storage

- Named prompt presets are stored in SQLite through Prisma.
- A preset contains the structured draft and its validated prompt.
- Presets can be loaded or deleted from the Hotprompter tab.
- Notepad text and numbered quick-memory slots are browser-local and separate from the preset database.

### New scoped Preset Library

The fourth tab adds a separate schema-2 library. Legacy SQLite presets remain available and are not silently migrated or overwritten.

The supported kinds are `complete`, `scene`, `subject`, and `camera`. Each preset declares `owns`; every rotary is a stable `key:encoded-option-value` ID from the current catalog. The server rejects cross-zone keys and unknown imported options. Merge order is **complete → scene → subject → camera → manual control edits**, with pinned controls preserved. Chip IDs are unioned; there is no separate chip-authoring control yet.

Use **Capture new** to capture only the selected zone from the current controls. Compose previews show incoming presets and removed contributions before Apply. A fork creates a new ID, parent ID and incremented version; capture while that kind is composed creates another child. Original control data is retained. Rename changes display metadata only. Content is not edited in place from the grid.

The browser includes name/fragment/note search, kind/source/view/date/keep-rate filters, query search chips, a virtualized grid, lockable kind slots, per-control pins, comparison variants, overlap warnings, bulk selection/export/trash/accept/restore, and import quarantine. Current search chips store query text; complete saved-filter bundles and portable saved searches are still pending.

Exports use a canonical JSON body and SHA-256 checksum. Import validates the whole envelope and every owns/option entry before writing; one invalid entry cancels the import. Verified imports must be explicitly accepted from quarantine. Existing IDs and tombstones cannot be overwritten. A checksum detects changes; it is not a signature or proof of author identity.

Trash is soft for 30 days. The next successful library mutation removes expired content and keeps its ID as a tombstone. Cleanup is lazy, not a scheduled background task; tombstones are currently retained rather than automatically expiring after two schema versions. Current-table drift is counted and reported on load. Unknown schemas are retained in storage and excluded from composition with an upgrade notice; a general v1 migration/read-only viewer is pending.

### Gallery provenance

New submissions capture preset IDs/kinds/versions/names, copies of the contributing preset definitions, per-fragment attribution, actual model names and loader, manual control overrides, prompts and sampler settings **before submission**. Unknown attribution is recorded as manual. Older images without a captured record are not reconstructed from the current editor.

Immutable records live in `.data/jobs/<full hash>.snapshot.json`. Marks and notes live separately in `.data/jobs/<full hash>.marks.json`. Keep/reject and notes updates are serialized per hash and atomically replace the sidecar only. Identical content hashes intentionally share a mark/notes record. Tests assert that updates leave snapshot bytes unchanged.

From a Gallery card, **Provenance / diff** opens the recorded settings and fragment attribution. Reuse seed changes the next panel seed only. Reuse prompt loads the recorded text as manual and clears preset attribution. Open in panel restores recorded controls and available matching preset versions. Diff compares recorded and current positive fragments; **Run diff** explicitly queues the current panel with the recorded seed and current remaining settings. It is not an isolated text-only comparison unless the operator also keeps all other settings equal. Scoped promotion captures only the chosen kind's controls.

K/X shortcuts mark a focused Gallery card or an open detail panel. Keep-rate ranking appears only after at least five marked unique job hashes contributed by that preset; merely being listed in the stack does not count unless the preset contributed a fragment. A zero-keep preset with at least eight marks receives a quiet retire hint. Rankings are associations, not controlled evidence that a preset caused the result.

PNG metadata receives the initial snapshot/provenance at SaveImage time; subsequent notes/marks do not rewrite the PNG. Export job JSON includes the frozen record and current sidecar. Restore/copy the `.data` directory when backing up the workspace; these local records are intentionally excluded from Git.

## Adult-content boundary

`ALLOW_EXPLICIT=true` exposes adult-only controls for this local workflow. It does not disable validation.

The application continues to reject or exclude content involving minors, non-consent, incest, real people or celebrities, distress, coercion, and related unsafe scenarios. Explicit option groups remain gated and submitted prompts are validated server-side before enhancement, storage, or image generation.

## API overview

| Route | Purpose |
| --- | --- |
| `GET /api/dashboard-status` | Service readiness and queue summary |
| `GET /api/prompt-models` | LM Studio and Ollama model discovery |
| `POST /api/prompt` | Build and validate a prompt from controls |
| `POST /api/enhance-prompt` | Enhance using the selected local provider/model |
| `POST /api/describe-image` | Create a starting prompt from an uploaded image |
| `POST /api/generate-image` | Submit a validated ComfyUI workflow |
| `GET /api/generate-image?promptId=...` | Poll one submitted job |
| `GET /api/image-queue` | Read queue and running-job state |
| `DELETE /api/image-queue` | Cancel one validated job ID |
| `GET /api/gallery` | List completed HOTPROMPTER outputs |
| `DELETE /api/gallery` | Permanently delete one validated gallery output |
| `GET /api/comfyui-image` | Same-origin proxy for a saved ComfyUI image |
| `/api/presets` | Prompt-library CRUD |
| `GET /api/preset-library` | Scoped library and eligible keep-rate statistics |
| `POST /api/preset-library` | Capture, fork, variants, import/quarantine, merge, rename, soft trash/restore |
| `GET /api/preset-library?export=1` | Hash-verified single/multi-preset JSON envelope |
| `GET /api/job-record/:hash` | Frozen snapshot and current provenance sidecar |
| `PATCH /api/job-record/:hash` | Keep/reject and notes only; snapshot fields rejected |

## Project structure

```text
app/
  api/                 Server-only provider, ComfyUI, gallery, and preset routes
  components/
    hotprompter.tsx    Prompt workstation
    engine-room.tsx    Readiness and queue controls
    gallery.tsx        Completed-image gallery
    image-job.tsx      Submitted-job drawer
    notepad.tsx        Persistent local notepad and numbered memories
    status.tsx         Shared dashboard polling/status rail
    preset-library.tsx Scoped preset browser / composition preview
    job-detail.tsx     Gallery provenance, diff, marks, notes, export
lib/
  comfyui.ts           Workflow submission and ComfyUI configuration
  comfy-progress.ts    Progress/event adapter
  lmstudio.ts          LM Studio adapter
  ollama.ts            Ollama adapter
  options.ts           Structured control definitions
  prompt.ts            Prompt construction and safety validation
  comfy-config.ts      Server model names and dimension cap
  comfy-encoder.ts     Inventory-based GGUF/INT8 encoder selection
  negative.ts          Deterministic negative groups and profiles
  snapshot.ts          Canonical hash and deep-frozen record
  provenance.ts        Shared provenance types / fragment helpers
  provenance-server.ts Capture-time preset attribution
  job-records.ts       Immutable records, sidecar writes and rankings
  preset-library.ts    Scoped ownership, option IDs, merge, drift and overlap
  preset-library-store.ts Atomic local library and checksum import/export
scripts/               Guarded launch profile and focused verification scripts
.data/                 Local scoped presets, immutable jobs and sidecars (not Git)
prisma/
  schema.prisma        SQLite prompt-preset schema
design-prototypes/     Reference renders and source category notes
ui-backup/             Preserved legacy interface files
```

## Validation

Run the production build before release or after configuration changes:

```powershell
Set-Location D:\HOTPROMPTER
npm.cmd run build
node scripts/verify-cpu-hardening.cjs
node scripts/verify-presets-provenance.cjs
```

Useful live checks:

```powershell
Invoke-RestMethod http://127.0.0.1:3002/api/dashboard-status
Invoke-RestMethod http://127.0.0.1:3002/api/image-queue
Invoke-RestMethod http://127.0.0.1:8188/system_stats
Invoke-RestMethod http://127.0.0.1:11434/api/tags
Invoke-RestMethod http://100.122.52.80:1234/v1/models
```

Build success confirms compilation, not full visual or end-to-end acceptance. A live image test is complete only after ComfyUI produces a `SaveImage` output and the image appears in Gallery.

## Problems and work still to resolve

| Priority | Issue | Next step |
| --- | --- | --- |
| High | Compatible Q4 Qwen3-VL encoder not installed/validated | Source the correct encoder and loader support, then test against INT8; do not substitute a generic chat GGUF |
| High | Memory/throughput targets not measured | After the existing queue drains, run the cold-start three-job benchmark in `PERFORMANCE_ACCEPTANCE.md` |
| High | New launch flags not applied to the existing running engine | Restart ComfyUI only during an idle window; verify actual `/system_stats` argv/device placement |
| High | PowerShell blocks the unsigned launcher | Use the documented inline command or an approved/signed launcher; execution policy has not been changed |
| Medium | Only the main library/provenance browser flows have been rendered-tested | Exercise large-library keyboard/drag flows, quarantine, restore/expiry, variants and archived schemas before broad sign-off |
| Medium | No measured negative-image quality or pixel-regression result | Compare fixed seeds/settings at resolved CFG 3; default Draft differs from the old 25-step profile |
| Medium | 64-GB fixed pagefile is only documented | Apply manually if desired and measure paging; it does not guarantee no thrash |
| Medium | Model snapshots record filenames, not weight-file digests | Add model checksums if exact cross-machine reproduction is required |
| Medium | The generic preset browser does not yet cover every proposed H detail | Finish full saved-filter bundles, thumbnail capture/filter, cross-node lineage diff/deep tree, bulk retag, exportable locks and exact drag-hover overwrite previews |
| Medium | General schema-v1 migration and two-version option tombstone lifecycle are not complete | Define the old schema precisely, migrate known IDs, and keep unsupported data read-only |
| Medium | Per-fragment manual overrides are captured from control changes only | Define an editor fragment model before claiming exact attribution of arbitrary free-text rewrites |
| Low | Initial PNG metadata does not contain later annotations | Export job JSON / back up sidecars to carry later marks and notes |
| Low | ComfyUI history is still the Gallery index | Persist an output index if the Gallery must survive engine history loss |

The proposed explicit-zone expansion is outside this implementation. There is no new 768 anatomy rule or derived explicit fragments. Batch variant generation, negative-side prompt diff, and portable session archives remain future work.

## Logs used by the current hidden startup

When the project is started by the local Codex workflow, logs are written to:

```text
D:\HOTPROMPTER\.runtime\hotprompter-3002.out.log
D:\HOTPROMPTER\.runtime\hotprompter-3002.err.log
D:\ComfyUI_windows_portable\comfyui-cpu.stdout.log
D:\ComfyUI_windows_portable\comfyui-cpu.stderr.log
```

The latest app-only activation uses `.runtime/library-provenance-final.out.log` and `.runtime/library-provenance-final.err.log`; timestamped older logs may also exist. A startup log saying `Ready` plus an HTTP health probe confirms the app server, not completed image generation.

## Design and handoff notes

- `UI_DESIGNER_HANDOFF.md` documents the frontend contracts and local-only design constraints.
- `design-prototypes\tab-1-hotprompter.png` is the Hotprompter reference render.
- `design-prototypes\tab-2-engine-room.png` is the Engine Room reference render.
- `design-prototypes\tab-3-gallery.png` is the Gallery reference render.
- `design-prototypes\catagories.txt` is the original user-supplied category source and remains preserved.

Future UI ideas should not be documented as complete until their backend behavior and rendered interface have both been verified.
