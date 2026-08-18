import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import * as schema from "./schema";

// Docker explicitly provides /data/dasho.db; local development stays inside the repository.
const databasePath = process.env.DATABASE_URL ?? join(process.cwd(), "data", "dasho.db");
mkdirSync(dirname(databasePath), { recursive: true });
const sqlite = new Database(databasePath);
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
