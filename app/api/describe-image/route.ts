import { NextResponse } from "next/server";
import { assertLocalAiUrl } from "@/lib/local-ai-url";

const OLLAMA = process.env.OLLAMA_URL ?? "http://localhost:11434";

// Vision model for image description - will try common ones
const VISION_MODELS = [
  "llava:13b",
  "llava",
  "bakllava",
  "llava:7b",
];

async function getVisionModel(): Promise<string | null> {
  // Check which vision models are available
  try {
    assertLocalAiUrl(OLLAMA, "Ollama vision server");
    const res = await fetch(`${OLLAMA}/api/tags`);
    if (res.ok) {
      const data = await res.json();
      const availableModels = (data.models || []).map((m: any) => m.name);
      for (const model of VISION_MODELS) {
        if (availableModels.includes(model)) {
          return model;
        }
      }
    }
  } catch {
    // Ollama not running
  }
  return null;
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("image") as File;

  if (!file) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  // Check file type and size
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Please upload an image file" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 413 });
  }

  // Find available vision model
  const visionModel = await getVisionModel();
  if (!visionModel) {
    return NextResponse.json({
      error: "No vision model found. Pull one with: ollama pull llava"
    }, { status: 400 });
  }

  try {
    assertLocalAiUrl(OLLAMA, "Ollama vision server");
    // Convert image to base64
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const imageData = `data:${file.type};base64,${base64}`;

    // Call Ollama vision model
    const res = await fetch(`${OLLAMA}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: visionModel,
        prompt: `Describe this image in detail for use in an AI image generation prompt. Focus on: subject (person/character), age, gender expression, heritage, body type, hair (color, texture, length, style), eye color, facial features, clothing/outfit, action/pose, scene/location, background, lighting, camera angle, art style. Be specific, descriptive, and thorough. Return only the description text, no additional commentary.`,
        images: [imageData],
        stream: false
      })
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: `Ollama error: ${detail}` }, { status: 502 });
    }

    const data = await res.json();
    const description = data.response?.trim() || "";

    if (!description) {
      return NextResponse.json({ error: "No description generated" }, { status: 502 });
    }

    return NextResponse.json({ description, model: visionModel });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to process image: ${err}` },
      { status: 500 }
    );
  }
}
