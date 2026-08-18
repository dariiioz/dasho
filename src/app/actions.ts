"use server";

import { eq, isNull, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { db } from "@/db";
import { folders, services, settings } from "@/db/schema";
import { cacheRemoteIcon, faviconCacheExists, resolveFavicon } from "@/lib/favicon";
import { folderSchema, serviceSchema, settingsSchema } from "@/lib/validators";

const writeAccess = async () => true; // Point d’entrée unique pour une future authentification.
const refresh = () => revalidatePath("/");
const idSchema = z.number().int().positive();

const reorderServiceSchema = z.array(
  z.object({ id: idSchema, folderId: idSchema.nullable(), position: z.number().int().nonnegative() }),
);
const reorderFolderSchema = z.array(
  z.object({ id: idSchema, position: z.number().int().nonnegative() }),
);

async function nextServicePosition(folderId: number | null) {
  const filter = folderId === null ? isNull(services.folderId) : eq(services.folderId, folderId);
  const row = await db.select({ value: max(services.position) }).from(services).where(filter).get();
  return (row?.value ?? -1) + 1;
}

async function externalFaviconEnabled() {
  const setting = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "enableExternalFaviconService"))
    .get();
  return setting ? setting.value === "true" : undefined;
}

export async function saveFolder(input: unknown) {
  await writeAccess();
  const value = folderSchema.parse(input);
  if (value.id) {
    await db.update(folders).set(value).where(eq(folders.id, value.id));
  } else {
    const row = await db.select({ value: max(folders.position) }).from(folders).get();
    await db.insert(folders).values({ ...value, position: value.position ?? (row?.value ?? -1) + 1 });
  }
  refresh();
}

export async function deleteFolder(id: number) {
  await writeAccess();
  await db.delete(folders).where(eq(folders.id, idSchema.parse(id)));
  refresh();
}

export async function saveService(input: unknown) {
  await writeAccess();
  const value = serviceSchema.parse(input);
  const previous = value.id
    ? await db.select().from(services).where(eq(services.id, value.id)).get()
    : undefined;
  const providedCacheValid = await faviconCacheExists(value.faviconCache);
  const needsIcon =
    value.iconType === "favicon" &&
    !providedCacheValid &&
    (!previous?.faviconCache || !(await faviconCacheExists(previous.faviconCache)) || previous.url !== value.url);
  const resolved = needsIcon
    ? await resolveFavicon(value.url, value.name, {
        enableExternalService: await externalFaviconEnabled(),
      })
    : null;
  const remoteIconCache =
    value.iconType === "url" && value.iconValue?.startsWith("http")
      ? await cacheRemoteIcon(value.iconValue)
      : null;
  const data = {
    ...value,
    iconValue: resolved?.monogram ?? value.iconValue,
    faviconCache:
      remoteIconCache ?? resolved?.cachePath ?? value.faviconCache ?? previous?.faviconCache ?? null,
    tags: JSON.stringify(value.tags),
    updatedAt: new Date(),
  };

  if (value.id) {
    await db.update(services).set(data).where(eq(services.id, value.id));
  } else {
    await db.insert(services).values({
      ...data,
      position: value.position ?? (await nextServicePosition(value.folderId ?? null)),
    });
  }
  refresh();
}

export async function duplicateService(id: number) {
  await writeAccess();
  const source = await db.select().from(services).where(eq(services.id, idSchema.parse(id))).get();
  if (!source) throw new Error("Service introuvable.");
  await db.insert(services).values({
    ...source,
    id: undefined,
    name: `${source.name} – copie`,
    position: await nextServicePosition(source.folderId),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  refresh();
}

export async function refreshServiceIcon(id: number) {
  await writeAccess();
  const service = await db.select().from(services).where(eq(services.id, idSchema.parse(id))).get();
  if (!service) throw new Error("Service introuvable.");
  const resolved = await resolveFavicon(service.url, service.name, {
    enableExternalService: await externalFaviconEnabled(),
  });
  await db
    .update(services)
    .set({ faviconCache: resolved.cachePath, iconValue: resolved.monogram, updatedAt: new Date() })
    .where(eq(services.id, service.id));
  refresh();
  return resolved;
}

export async function deleteService(id: number) {
  await writeAccess();
  await db.delete(services).where(eq(services.id, idSchema.parse(id)));
  refresh();
}

export async function restoreService(input: unknown) {
  await writeAccess();
  const value = serviceSchema.parse(input);
  await db.insert(services).values({
    ...value,
    id: undefined,
    tags: JSON.stringify(value.tags),
    favorite: value.favorite ?? false,
    clickCount: value.clickCount ?? 0,
    position: value.position ?? (await nextServicePosition(value.folderId ?? null)),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  refresh();
}

export async function toggleServiceFavorite(id: number) {
  await writeAccess();
  const service = await db.select({ favorite: services.favorite }).from(services).where(eq(services.id, idSchema.parse(id))).get();
  if (!service) throw new Error("Service introuvable.");
  const favorite = !service.favorite;
  await db.update(services).set({ favorite, updatedAt: new Date() }).where(eq(services.id, idSchema.parse(id)));
  refresh();
  return favorite;
}

export async function reorderServices(input: unknown) {
  await writeAccess();
  const items = reorderServiceSchema.parse(input);
  db.transaction((tx) => {
    for (const item of items) {
      tx.update(services)
        .set({ folderId: item.folderId, position: item.position, updatedAt: new Date() })
        .where(eq(services.id, item.id))
        .run();
    }
  });
  refresh();
}

export async function reorderFolders(input: unknown) {
  await writeAccess();
  const items = reorderFolderSchema.parse(input);
  db.transaction((tx) => {
    for (const item of items) {
      tx.update(folders).set({ position: item.position }).where(eq(folders.id, item.id)).run();
    }
  });
  refresh();
}

export async function saveSettings(input: unknown) {
  await writeAccess();
  const values = settingsSchema.parse(input);
  db.transaction((tx) => {
    for (const [key, value] of Object.entries(values)) {
      tx.insert(settings)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } })
        .run();
    }
  });
  refresh();
}

const dashySchema = z.object({
  sections: z.array(
    z.object({
      name: z.string().default("Import Dashy"),
      icon: z.string().optional(),
      items: z.array(
        z.object({
          title: z.string().optional(),
          name: z.string().optional(),
          url: z.string(),
          description: z.string().optional(),
          icon: z.string().optional(),
          tags: z.array(z.string()).optional(),
        }),
      ).default([]),
    }),
  ).default([]),
});

const importedSettingsSchema = z.record(z.string(), z.unknown()).transform((record) =>
  settingsSchema.partial().parse({
    ...record,
    columns: record.columns === undefined ? undefined : Number(record.columns),
    statusCheckInterval:
      record.statusCheckInterval === undefined ? undefined : Number(record.statusCheckInterval),
    showSearchOnLoad:
      record.showSearchOnLoad === undefined
        ? undefined
        : record.showSearchOnLoad === true || record.showSearchOnLoad === "true",
    enableExternalFaviconService:
      record.enableExternalFaviconService === undefined
        ? undefined
        : record.enableExternalFaviconService === true ||
          record.enableExternalFaviconService === "true",
  }),
);

const exportSchema = z.object({
  folders: z.array(folderSchema),
  services: z.array(serviceSchema),
  settings: importedSettingsSchema.default({}),
});

export async function importConfiguration(content: string, format: "json" | "dashy") {
  await writeAccess();
  if (content.length > 2_000_000) throw new Error("Le fichier dépasse 2 Mo.");
  const parsed = format === "json" ? JSON.parse(content) : parseYaml(content);
  const normalized = format === "json" ? exportSchema.parse(parsed) : normalizeDashy(parsed);

  let importedFolders = 0;
  let importedServices = 0;
  const remoteIcons: Array<{ id: number; url: string }> = [];
  db.transaction((tx) => {
    const folderIds: number[] = [];
    const folderIdMap = new Map<number, number>();
    for (const folder of normalized.folders) {
      const result = tx.insert(folders).values({
        name: folder.name,
        icon: folder.icon ?? null,
        color: folder.color ?? null,
        collapsed: folder.collapsed ?? false,
        position: folder.position ?? importedFolders,
      }).run();
      const newId = Number(result.lastInsertRowid);
      folderIds.push(newId);
      if ("id" in folder && folder.id) folderIdMap.set(folder.id, newId);
      importedFolders += 1;
    }
    for (const rawService of normalized.services) {
      const folderId =
        "folderIndex" in rawService
          ? folderIds[rawService.folderIndex] ?? null
          : rawService.folderId
            ? folderIdMap.get(rawService.folderId) ?? null
            : null;
      const service = serviceSchema.parse({ ...rawService, folderId });
      const result = tx.insert(services).values({
        ...service,
        id: undefined,
        tags: JSON.stringify(service.tags),
        position: service.position ?? importedServices,
        updatedAt: new Date(),
      }).run();
      if (service.iconType === "url" && service.iconValue?.startsWith("http")) {
        remoteIcons.push({ id: Number(result.lastInsertRowid), url: service.iconValue });
      }
      importedServices += 1;
    }
    for (const [key, value] of Object.entries(normalized.settings)) {
      if (value === undefined) continue;
      tx.insert(settings)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } })
        .run();
    }
  });
  for (let index = 0; index < remoteIcons.length; index += 5) {
    await Promise.all(
      remoteIcons.slice(index, index + 5).map(async (icon) => {
        try {
          const cachePath = await cacheRemoteIcon(icon.url);
          await db.update(services).set({ faviconCache: cachePath }).where(eq(services.id, icon.id));
        } catch {
          // L’import reste valide et le monogramme prend le relais.
        }
      }),
    );
  }
  refresh();
  return { folders: importedFolders, services: importedServices };
}

function normalizeDashy(input: unknown) {
  const dashy = dashySchema.parse(input);
  return {
    folders: dashy.sections.map((section, position) => ({
      name: section.name,
      icon: section.icon ?? null,
      color: null,
      collapsed: false,
      position,
    })),
    services: dashy.sections.flatMap((section, folderIndex) =>
      section.items.map((item, position) => ({
        name: item.title ?? item.name ?? new URL(item.url).hostname,
        url: item.url,
        description: item.description ?? null,
        folderIndex,
        iconType: item.icon?.startsWith("http") ? "url" as const : item.icon ? "simple-icon" as const : "favicon" as const,
        iconValue: item.icon ?? null,
        faviconCache: null,
        openInNewTab: true,
        statusCheckEnabled: false,
        statusUrl: null,
        tags: item.tags ?? [],
        position,
      })),
    ),
    settings: {},
  };
}
