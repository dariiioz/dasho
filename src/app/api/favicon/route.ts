import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { resolveFavicon } from "@/lib/favicon";

const bodySchema = z.object({ url: z.url(), name: z.string().trim().max(100).optional() });

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const external = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "enableExternalFaviconService"))
      .get();
    return Response.json(
      await resolveFavicon(body.url, body.name, {
        enableExternalService: external ? external.value === "true" : undefined,
      }),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Résolution impossible." },
      { status: 400 },
    );
  }
}
