CREATE TABLE `folders` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `icon` text,
  `color` text,
  `position` integer DEFAULT 0 NOT NULL,
  `collapsed` integer DEFAULT false NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `folders_position_idx` ON `folders` (`position`);
--> statement-breakpoint
CREATE TABLE `services` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `folder_id` integer,
  `name` text NOT NULL,
  `url` text NOT NULL,
  `description` text,
  `icon_type` text DEFAULT 'favicon' NOT NULL,
  `icon_value` text,
  `favicon_cache` text,
  `open_in_new_tab` integer DEFAULT true NOT NULL,
  `status_check_enabled` integer DEFAULT false NOT NULL,
  `status_url` text,
  `tags` text DEFAULT '[]' NOT NULL,
  `position` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `services_folder_position_idx` ON `services` (`folder_id`,`position`);
--> statement-breakpoint
CREATE INDEX `services_name_idx` ON `services` (`name`);
--> statement-breakpoint
CREATE TABLE `settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_idx` ON `settings` (`key`);
