import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { count } from "drizzle-orm";
import { folders, services, settings } from "../src/db/schema";

const databasePath = process.env.DATABASE_URL ?? "/data/dasho.db";
const sqlite = new Database(databasePath);
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

const existing = db.select({ value: count() }).from(folders).get();
if ((existing?.value ?? 0) > 0) {
  console.log("Seed ignored: the database already contains folders.");
  sqlite.close();
  process.exit(0);
}

const now = new Date();
const insertedFolders = db
  .insert(folders)
  .values([
    { name: "Infrastructure", icon: "Server", color: "#38bdf8", position: 0, createdAt: now },
    { name: "Médias", icon: "Film", color: "#c084fc", position: 1, createdAt: now },
    { name: "Productivité", icon: "BriefcaseBusiness", color: "#34d399", position: 2, createdAt: now },
  ])
  .returning()
  .all();

const [infrastructure, media, productivity] = insertedFolders;
if (!infrastructure || !media || !productivity) throw new Error("Could not create demo folders.");

db.insert(services)
  .values([
    { folderId: infrastructure.id, name: "Proxmox", url: "https://proxmox.local", description: "Virtualisation", iconType: "simple-icon", iconValue: "proxmox", tags: '["infra","vm"]', position: 0, statusCheckEnabled: true, createdAt: now, updatedAt: now },
    { folderId: infrastructure.id, name: "Grafana", url: "https://grafana.local", description: "Observabilité", iconType: "simple-icon", iconValue: "grafana", tags: '["infra","metrics"]', position: 1, statusCheckEnabled: true, createdAt: now, updatedAt: now },
    { folderId: infrastructure.id, name: "Home Assistant", url: "https://home.local", description: "Domotique", iconType: "simple-icon", iconValue: "homeassistant", tags: '["maison"]', position: 2, createdAt: now, updatedAt: now },
    { folderId: infrastructure.id, name: "Gitea", url: "https://git.local", description: "Dépôts Git", iconType: "simple-icon", iconValue: "gitea", tags: '["dev"]', position: 3, createdAt: now, updatedAt: now },
    { folderId: media.id, name: "Jellyfin", url: "https://jellyfin.local", description: "Films et séries", iconType: "simple-icon", iconValue: "jellyfin", tags: '["media"]', position: 0, createdAt: now, updatedAt: now },
    { folderId: media.id, name: "Sonarr", url: "https://sonarr.local", description: "Séries TV", iconType: "simple-icon", iconValue: "sonarr", tags: '["media"]', position: 1, createdAt: now, updatedAt: now },
    { folderId: media.id, name: "Radarr", url: "https://radarr.local", description: "Films", iconType: "simple-icon", iconValue: "radarr", tags: '["media"]', position: 2, createdAt: now, updatedAt: now },
    { folderId: productivity.id, name: "Nextcloud", url: "https://cloud.local", description: "Fichiers et collaboration", iconType: "simple-icon", iconValue: "nextcloud", tags: '["fichiers"]', position: 0, createdAt: now, updatedAt: now },
    { folderId: productivity.id, name: "Vaultwarden", url: "https://vault.local", description: "Coffre-fort", iconType: "simple-icon", iconValue: "vaultwarden", tags: '["sécurité"]', position: 1, createdAt: now, updatedAt: now },
    { folderId: productivity.id, name: "Portainer", url: "https://portainer.local", description: "Conteneurs Docker", iconType: "simple-icon", iconValue: "portainer", tags: '["infra","docker"]', position: 2, createdAt: now, updatedAt: now },
  ])
  .run();

db.insert(settings)
  .values([
    { key: "theme", value: "system" },
    { key: "columns", value: "5" },
    { key: "cardSize", value: "medium" },
    { key: "title", value: "Dasho" },
    { key: "showSearchOnLoad", value: "true" },
    { key: "statusCheckInterval", value: "60" },
  ])
  .onConflictDoNothing({ target: settings.key })
  .run();

console.log("Seed complete: 3 folders and 10 services created.");
sqlite.close();
