import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sanitizeDraft } from "@/lib/options";
import { buildPrompt, validatePrompt } from "@/lib/prompt";

export async function GET() {
  const presets = await prisma.preset.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ presets });
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body?.name ?? "").trim().slice(0, 80);
  
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const allowExplicit = process.env.ALLOW_EXPLICIT === "true";
  const draft = sanitizeDraft(body?.draft, allowExplicit);
  const prompt = buildPrompt(draft, { allowExplicit });
  const validation = validatePrompt(prompt);

  if (!validation.allowed) {
    return NextResponse.json({ error: validation.reason }, { status: 422 });
  }

  const preset = await prisma.preset.create({
    data: { name, draft: JSON.stringify(draft), prompt }
  });

  return NextResponse.json({ preset }, { status: 201 });
}
