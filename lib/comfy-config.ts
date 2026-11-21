// Server configuration. Names must match ComfyUI's registered model inventory.
export const COMFY_MODELS = {
  unet: process.env.COMFYUI_UNET_MODEL ?? "qwen-image-2.1-UC-Q4_K_M.gguf",
  clip: process.env.COMFYUI_CLIP_MODEL ?? "qwen3vl_8b_int8_convrot.safetensors",
  vae: process.env.COMFYUI_VAE_MODEL ?? "qwen_image_2.1_vae_bf16.safetensors"
};

// Leave unset until a compatible Qwen Image 2.1 encoder has been sourced/tested.
export const Q4_ENCODER_FILE = process.env.COMFYUI_CLIP_Q4_MODEL?.trim() ?? "";
export const FALLBACK_ENCODER_FILE = process.env.COMFYUI_CLIP_FALLBACK_MODEL?.trim()
  || (COMFY_MODELS.clip.toLowerCase().endsWith(".gguf")
    ? "qwen3vl_8b_int8_convrot.safetensors" : COMFY_MODELS.clip);
export const MAX_IMAGE_DIMENSION = 512;
