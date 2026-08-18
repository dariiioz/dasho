import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "Image invalide ou supérieure à 2 Mo." }, { status: 400 });
    }
    const body = Buffer.from(await file.arrayBuffer());
    const extension = file.type === "image/svg+xml" ? "svg" : file.type === "image/x-icon" ? "ico" : "webp";
    const filename = `${createHash("sha256").update(body).digest("hex")}.${extension}`;
    const directory = join(process.env.DATA_DIR ?? join(process.cwd(), "data"), "icons");
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, filename),
      extension === "svg" || extension === "ico"
        ? body
        : await sharp(body).resize(128, 128, { fit: "inside", withoutEnlargement: false }).webp().toBuffer(),
    );
    return Response.json({ cachePath: `icons/${filename}` });
  } catch {
    return Response.json({ error: "Upload impossible." }, { status: 400 });
  }
}
