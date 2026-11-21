import { NextResponse } from "next/server";
import { readFrozenRecord, readMarks, updateMarks, validJobHash } from "@/lib/job-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { hash: string } }) {
  if (!validJobHash(params.hash)) return NextResponse.json({ error: "Invalid job hash." }, { status: 400 });
  const snapshot = await readFrozenRecord(params.hash);
  if (!snapshot) return NextResponse.json({ error: "This image has no captured provenance record." }, { status: 404 });
  const sidecar = await readMarks(params.hash);
  return NextResponse.json({ snapshot, provenance: { ...snapshot.provenance, ...sidecar } }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: Request, { params }: { params: { hash: string } }) {
  if (!validJobHash(params.hash)) return NextResponse.json({ error: "Invalid job hash." }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => key !== "marks" && key !== "notes")
    || (body.marks !== undefined && !["keep", "reject", null].includes(body.marks))
    || (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > 2000))) {
    return NextResponse.json({ error: "Only keep/reject marks and notes up to 2000 characters may be changed." }, { status: 400 });
  }
  if (!await readFrozenRecord(params.hash)) return NextResponse.json({ error: "Frozen job not found." }, { status: 404 });
  return NextResponse.json(await updateMarks(params.hash, body));
}
