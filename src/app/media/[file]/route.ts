import fs from "node:fs";
import path from "node:path";
import { mediaDir } from "@/lib/media";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", webm: "video/webm" };

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[a-f0-9-]+\.(jpg|jpeg|png|webp|mp4|webm)$/.test(file)) return new Response("Not found", { status: 404 });
  const p = path.join(mediaDir(), file);
  if (!fs.existsSync(p)) return new Response("Not found", { status: 404 });
  const ext = file.split(".").pop()!;
  return new Response(fs.readFileSync(p), { headers: { "content-type": TYPES[ext], "cache-control": "public, max-age=31536000, immutable" } });
}
