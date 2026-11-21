# CPU hardening acceptance

## Implemented checks

- CPU and optional low-VRAM launch profiles keep smart memory enabled, use PyTorch attention, and disable previews. The active engine is never restarted by the launcher when `/system_stats` is online.
- Outputs are capped server-side at 512 in each dimension; UI offers 512 only.
- Encoder selection checks actual ComfyUI inventory, switches loader by extension, and warns on INT8 fallback. New snapshots/hash/PNG metadata record the selected model names and loader.
- Deterministic negatives, server-resolved CFG, frozen hashes/settings, seed capture and reuse are preserved from the previous implementation.
- Ollama 1.05 repeat penalty / 140 predicted tokens; shared 60-second inventory cache, concurrent-request deduplication, and asynchronous startup discovery.

## Corrections to the supplied example

The installed `TextEncodeQwenImage21` consumes `prompt`, `negative_prompt`, and `resolution`, and returns positive and negative conditioning from one node. Keep both text inputs even when negative is empty. Node 5 is the existing `EmptyLatentImage`; two encoder nodes with a `text` input would violate this installation's schema. The installed cache takes `dtype: int8`, not `cache_mode: INT8`.

CFG 1 skips the unconditional branch in the installed sampler. A request with negative text and requested CFG 1 is coerced to CFG 3, so it should match the same prompt/negative/seed at requested CFG 3. Those two cases cannot prove negative influence by being different. Compare negative A and negative B at the same resolved CFG 3 instead. Empty negatives always resolve to CFG 1 under the requested server policy.

## Pending live acceptance

1. Preserve the current ComfyUI queue. Schedule cold-start tests only after it drains and the operator stops the engine.
2. For pre-change regression, explicitly use the original 25 steps, original encoder and all original model/sampler settings, 512 dimensions, same prompt and seed, empty negative and CFG 1. Draft now uses 12 steps, so comparing default profiles would not isolate regression. Exact pixel equality also depends on device, precision, software versions and deterministic kernels.
3. Compare requested CFG 1 versus 3 with the same non-empty negative: verify both snapshots resolve to 3 and contain the same settings/hash. Compare resulting pixels in a controlled deterministic run.
4. Hold resolved CFG 3, seed and all other settings constant; change only negative text. Confirm distinct full hashes and distinct ComfyUI prompt IDs; verify each saved image maps to its own job. Use `文字` against a positive requesting in-frame text for a visual negative-conditioning check; evaluate outputs rather than assuming an effect.
5. Once a compatible Q4 encoder is sourced, verify Q4 selection and loader compatibility. During an idle controlled test, make that test file unavailable and confirm an INT8 fallback warning, recorded INT8 model name/hash, and completed saved output. Inventory-mocked fallback checks do not prove a real Q4 execution succeeds.
6. Run three sequential queued Draft jobs after a cold start. Measure the ComfyUI process working set (RSS), private bytes, system commit, available RAM and paging throughout encoder loading, sampling, decode and save. Report observed peak and paging evidence against the proposed under-26-GB RSS target. No such cold-start benchmark has been run in this pass.

## Source and runtime limitations

The currently observed engine is CPU-only. `--lowvram` is an alternative profile and may use GPU sampling; it does not implement a fixed CPU-sampler/GPU-VAE partition. Flags take effect only on the next engine launch. No pagefile setting was changed. The Q4 encoder is not yet installed or verified as a drop-in; no memory or throughput improvement is claimed from it.
