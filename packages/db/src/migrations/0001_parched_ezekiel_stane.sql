PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_refresh_tokens`("id", "user_id", "token_hash", "expires_at", "revoked_at", "created_at") SELECT "id", "user_id", "token_hash", "expires_at", "revoked_at", "created_at" FROM `refresh_tokens`;--> statement-breakpoint
DROP TABLE `refresh_tokens`;--> statement-breakpoint
ALTER TABLE `__new_refresh_tokens` RENAME TO `refresh_tokens`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `refresh_tokens_token_hash_idx` ON `refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_user_id_idx` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_mailbox_users` (
	`id` text PRIMARY KEY NOT NULL,
	`mailbox_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_mailbox_users`("id", "mailbox_id", "user_id", "created_at") SELECT "id", "mailbox_id", "user_id", "created_at" FROM `mailbox_users`;--> statement-breakpoint
DROP TABLE `mailbox_users`;--> statement-breakpoint
ALTER TABLE `__new_mailbox_users` RENAME TO `mailbox_users`;--> statement-breakpoint
CREATE UNIQUE INDEX `mailbox_users_mailbox_id_user_id_unique` ON `mailbox_users` (`mailbox_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `__new_team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_team_members`("id", "team_id", "user_id", "created_at") SELECT "id", "team_id", "user_id", "created_at" FROM `team_members`;--> statement-breakpoint
DROP TABLE `team_members`;--> statement-breakpoint
ALTER TABLE `__new_team_members` RENAME TO `team_members`;--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_team_id_user_id_unique` ON `team_members` (`team_id`,`user_id`);