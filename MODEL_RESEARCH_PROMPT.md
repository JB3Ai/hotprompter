# Local model and image-tool research prompt

Research the best current local AI models and supporting tools for the following Windows setup. Use information current as of today, browse the web, and prioritize official model cards, official documentation, maintained GitHub repositories, and recent reproducible benchmarks. Do not rely on parameter count or model-file size alone.

## Existing system

- Windows machine with 32 GiB system RAM.
- NVIDIA T400 4 GB GPU; approximately 3 GB VRAM is normally free.
- CPU/RAM inference is acceptable; speed is secondary to output quality and reliability.
- LM Studio server: `http://100.122.52.80:1234`.
- HOTPROMPTER is a Next.js prompt-building application.
- ComfyUI 0.42.1 runs image generation primarily on CPU at `http://127.0.0.1:8188`.
- Current image model: Qwen Image 2.1 Uncensored Q4_K_M GGUF.
- Current text candidate: Qwen 3.5 4B Uncensored Q8_0 in LM Studio.
- Current text benchmark: about 5.4 tokens/second after warm-up and 24–29 seconds for a roughly 150-token enhanced image prompt.
- When ComfyUI and the Qwen text model are both resident, only about 3 GiB RAM remains free.
- LM Studio GPU-max testing did not measurably increase VRAM use or improve prompt-generation speed.

## Intended pipeline

1. User builds a structured draft or chats with a small responsive model.
2. A stronger text model expands it into a precise Qwen Image 2.1 prompt.
3. An optional vision-language model describes uploaded reference images.
4. HOTPROMPTER submits the final validated prompt to ComfyUI.
5. ComfyUI returns the generated image to HOTPROMPTER's viewer.

The text server and image server may eventually run on separate devices, so evaluate both same-machine and split-device designs.

## Models to find

Find and compare:

1. A responsive 2B–5B chat/control model for drafting and field assistance.
2. The best practical 7B–14B prompt-enhancement model for detailed photographic, cinematic, anime and fantasy image prompts.
3. A vision-language model that works in current LM Studio and can accurately convert an uploaded image into an image-generation prompt.
4. The strongest model that can run while ComfyUI remains loaded on this 32 GiB machine.
5. The strongest model that can run when ComfyUI is stopped and LM Studio has nearly all available RAM.
6. Less-restricted or abliterated variants where available, while clearly identifying their base model, provenance, license, quality loss and risks.
7. Current ComfyUI image models, GGUF loaders, custom nodes and workflows that are genuinely compatible with CPU/RAM-heavy inference and 32 GiB RAM.

## Verification requirements

For every recommendation verify:

- Exact repository, filename, quantization and download size.
- Base-model provenance and license.
- Current LM Studio or llama.cpp compatibility; note required runtime versions.
- Whether a separate multimodal projector is required.
- Estimated total runtime RAM at 8K and 16K context, including weights, KV cache and overhead—not merely download size.
- Realistic T400 4 GB GPU offload expectations.
- Tool use, structured output, reasoning controls and vision capability.
- Whether the model is instruction-following, creative, prompt-specialized, coding-specialized or merely an encoder.
- Known failure reports, broken chat templates, tokenizer problems or architecture-loader issues.
- Publication/update date and whether the project is actively maintained.

Do not recommend image diffusion GGUF files as chat LLMs or text encoders as conversational models. Do not assume a model fits merely because its GGUF file is smaller than available RAM.

## Required output

Return:

1. A concise architecture recommendation for same-machine use and split-device use.
2. A comparison table with model, role, quant, file size, estimated runtime RAM, context, expected speed class, vision support, restrictions, license and source links.
3. A ranked shortlist: **use now**, **download next**, **maximum-quality experiment**, and **avoid**.
4. Exact LM Studio load settings for each shortlisted model: context length, GPU offload, KV-cache placement, flash attention, parallel requests and TTL.
5. Five fixed benchmark prompts that test instruction following, prompt enrichment, adult-only character consistency, spatial composition and reference-image description.
6. A staged test plan that downloads only one new model at a time and defines pass/fail criteria before moving to the next candidate.
7. Any recommended ComfyUI custom nodes or workflow templates with exact repository links and compatibility notes.

Clearly label measured facts, publisher claims and your own estimates. Cite every current technical or model-specific claim directly beside it.
