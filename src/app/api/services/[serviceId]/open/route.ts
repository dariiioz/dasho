import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";

type RouteContext = { params: Promise<{ serviceId: string }> };

export async function POST(_: Request, { params }: RouteContext) {
  const { serviceId } = await params;
  const id = Number(serviceId);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const [updated] = await db
    .update(services)
    .set({ clickCount: sql`${services.clickCount} + 1` })
    .where(eq(services.id, id))
    .returning({ id: services.id });
  if (!updated) {
    return Response.json({ error: "Service introuvable." }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
