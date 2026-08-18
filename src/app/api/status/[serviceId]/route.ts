import { eq } from "drizzle-orm";
import { Agent, fetch as undiciFetch } from "undici";
import { z } from "zod";
import { db } from "@/db";
import { services } from "@/db/schema";

const paramsSchema = z.object({ serviceId: z.coerce.number().int().positive() });
const selfSignedDispatcher = new Agent({ connect: { rejectUnauthorized: false } });

async function check(target: string, method: "HEAD" | "GET") {
  const allowSelfSigned = process.env.ALLOW_SELF_SIGNED_CERTIFICATES?.toLowerCase() === "true";
  return undiciFetch(target, {
    method,
    signal: AbortSignal.timeout(3_000),
    redirect: "follow",
    ...(allowSelfSigned ? { dispatcher: selfSignedDispatcher } : {}),
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ serviceId: string }> }) {
  try {
    const { serviceId } = paramsSchema.parse(await params);
    const service = await db.select().from(services).where(eq(services.id, serviceId)).get();
    if (!service?.statusCheckEnabled) {
      return Response.json({ status: "unknown", responseTime: null });
    }
    const target = service.statusUrl ?? service.url;
    const startedAt = performance.now();
    let response: Response;
    try {
      response = (await check(target, "HEAD")) as unknown as Response;
      if (!response.ok) response = (await check(target, "GET")) as unknown as Response;
    } catch {
      response = (await check(target, "GET")) as unknown as Response;
    }
    return Response.json(
      { status: response.ok ? "up" : "down", responseTime: Math.round(performance.now() - startedAt) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "down", responseTime: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
