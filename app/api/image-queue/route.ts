import { NextResponse } from "next/server";
import { cancelComfyJob, readComfyQueue } from "@/lib/comfy-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safePromptId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value) ? value : null;
}

export async function GET() {
  try {
    return NextResponse.json(await readComfyQueue());
  } catch {
    return NextResponse.json(
      { error: "The local ComfyUI queue is unavailable." },
      { status: 503 }
    );
  }
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({})) as { promptId?: unknown };
  const promptId = safePromptId(body.promptId);
  if (!promptId) {
    return NextResponse.json({ error: "A valid promptId is required." }, { status: 400 });
  }

  try {
    const cancelled = await cancelComfyJob(promptId);
    return NextResponse.json({ cancelled, promptId });
  } catch {
    return NextResponse.json(
      { error: "The local ComfyUI job could not be cancelled." },
      { status: 503 }
    );
  }
}
