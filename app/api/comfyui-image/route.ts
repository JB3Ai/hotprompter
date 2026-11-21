import { NextResponse } from "next/server";
import { comfyFetch } from "@/lib/comfyui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilename(value: string | null): value is string {
  return Boolean(value && value !== "." && value !== ".." && !/[\\/]/.test(value));
}

function safeSubfolder(value: string): boolean {
  return !value.includes(":") && !value.startsWith("/") &&
    value.split(/[\\/]/).every((part) => part !== "..");
}

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const filename = requestUrl.searchParams.get("filename");
  const subfolder = requestUrl.searchParams.get("subfolder") ?? "";
  const type = requestUrl.searchParams.get("type") ?? "output";
  const download = requestUrl.searchParams.get("download") === "1";

  if (!safeFilename(filename) || !safeSubfolder(subfolder) || !["input", "output", "temp"].includes(type)) {
    return NextResponse.json({ error: "Invalid ComfyUI image reference." }, { status: 400 });
  }

  const params = new URLSearchParams({ filename, subfolder, type });

  try {
    const response = await comfyFetch(`/view?${params.toString()}`, {}, 30_000);
    if (!response.ok || !response.body) {
      return NextResponse.json({ error: "The generated image is no longer available." }, { status: 404 });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "image/png",
        "Cache-Control": "no-store",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename.replace(/\"/g, "")}"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Could not retrieve the image from ComfyUI." }, { status: 503 });
  }
}
