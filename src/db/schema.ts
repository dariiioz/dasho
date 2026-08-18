import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const folders = sqliteTable(
  "folders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    icon: text("icon"),
    color: text("color"),
    position: integer("position").notNull().default(0),
    collapsed: integer("collapsed", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [index("folders_position_idx").on(table.position)],
);

export const services = sqliteTable(
  "services",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    folderId: integer("folder_id").references(() => folders.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    description: text("description"),
    iconType: text("icon_type", {
      enum: ["favicon", "simple-icon", "lucide", "url", "emoji"],
    }).notNull().default("favicon"),
    iconValue: text("icon_value"),
    faviconCache: text("favicon_cache"),
    openInNewTab: integer("open_in_new_tab", { mode: "boolean" }).notNull().default(true),
    statusCheckEnabled: integer("status_check_enabled", { mode: "boolean" }).notNull().default(false),
    statusUrl: text("status_url"),
    tags: text("tags").notNull().default("[]"),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("services_folder_position_idx").on(table.folderId, table.position),
    index("services_name_idx").on(table.name),
  ],
);

export const settings = sqliteTable(
  "settings",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
  },
  (table) => [uniqueIndex("settings_key_idx").on(table.key)],
);

export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
