ALTER TABLE `services` ADD `favorite` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `services` ADD `click_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX `services_popularity_idx` ON `services` (`click_count`);
