import * as icons from "simple-icons";
import { z } from "zod";

const paramsSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/).max(100) });

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = paramsSchema.parse(await params);
  const icon = Object.values(icons).find((candidate) => candidate.slug === slug);
  if (!icon) return new Response(null, { status: 404 });
  const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#${icon.hex}"><path d="${icon.path}"/></svg>`;
  return new Response(body, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=604800" },
  });
}
