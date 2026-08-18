import { asc } from "drizzle-orm";
import { db } from "@/db";
import { folders, services, settings } from "@/db/schema";

export async function GET() {
  const [folderRows, serviceRows, settingRows] = await Promise.all([
    db.select().from(folders).orderBy(asc(folders.position)),
    db.select().from(services).orderBy(asc(services.position)),
    db.select().from(settings),
  ]);
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    folders: folderRows,
    services: serviceRows.map((service) => ({
      ...service,
      tags: JSON.parse(service.tags) as string[],
    })),
    settings: Object.fromEntries(settingRows.map((setting) => [setting.key, setting.value])),
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dasho-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
