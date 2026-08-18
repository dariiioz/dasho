import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
const paramsSchema = z.object({ path: z.array(z.string().regex(/^[a-f0-9]{64}\.(webp|svg|ico)$/)) });
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) { try { const { path } = paramsSchema.parse(await params); const filename = path.at(-1)!; const body = await readFile(join(process.env.DATA_DIR ?? join(process.cwd(), "data"), "icons", filename)); return new Response(body, { headers: { "Content-Type": filename.endsWith(".svg") ? "image/svg+xml" : filename.endsWith(".ico") ? "image/x-icon" : "image/webp" } }); } catch { return new Response(null, { status: 404 }); } }
