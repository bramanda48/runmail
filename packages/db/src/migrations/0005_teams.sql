CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_name_unique` ON `teams` (`name`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL REFERENCES `teams`(`id`),
	`user_id` text NOT NULL REFERENCES `users`(`id`),
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_team_id_user_id_unique` ON `team_members` (`team_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `mailbox_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`mailbox_id` text NOT NULL REFERENCES `mailboxes`(`id`),
	`team_id` text NOT NULL REFERENCES `teams`(`id`),
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mailbox_teams_mailbox_id_team_id_unique` ON `mailbox_teams` (`mailbox_id`,`team_id`);
