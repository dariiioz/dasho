import { asc } from "drizzle-orm";
import { db } from "@/db";
import { folders, services, settings } from "@/db/schema";
import { faviconCacheExists } from "@/lib/favicon";

function parseTags(value: string) {
  try {
    const tags = JSON.parse(value);
    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const [folderRows, serviceRows, settingRows] = await Promise.all([
    db.select().from(folders).orderBy(asc(folders.position)),
    db.select().from(services).orderBy(asc(services.position)),
    db.select().from(settings),
  ]);
  const serializedServices = await Promise.all(
    serviceRows.map(async (service) => ({
      ...service,
      tags: parseTags(service.tags),
      iconMissing:
        service.iconType === "favicon" &&
        ((!service.faviconCache && !service.iconValue) ||
          (Boolean(service.faviconCache) && !(await faviconCacheExists(service.faviconCache)))),
    })),
  );
  return Response.json({
    folders: folderRows,
    services: serializedServices,
    settings: Object.fromEntries(settingRows.map((item) => [item.key, item.value])),
  });
}
