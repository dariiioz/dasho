import * as icons from "simple-icons";
import { z } from "zod";

const querySchema = z.object({ q: z.string().trim().max(80).default("") });

export async function GET(request: Request) {
  const { q } = querySchema.parse({ q: new URL(request.url).searchParams.get("q") ?? "" });
  const normalized = q.toLocaleLowerCase("fr");
  const results = Object.values(icons)
    .filter((icon) =>
      normalized ? `${icon.title} ${icon.slug}`.toLocaleLowerCase("fr").includes(normalized) : true,
    )
    .slice(0, 80)
    .map(({ title, slug, hex, path }) => ({ title, slug, hex, path }));
  return Response.json(results, { headers: { "Cache-Control": "public, max-age=3600" } });
}
