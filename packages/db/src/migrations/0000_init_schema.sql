CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `domains` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_name` text NOT NULL,
	`verification_status` text DEFAULT 'pending_verification' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domains_domain_name_unique` ON `domains` (`domain_name`);--> statement-breakpoint
CREATE TABLE `mailbox_users` (
	`id` text PRIMARY KEY NOT NULL,
	`mailbox_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mailbox_users_mailbox_id_user_id_unique` ON `mailbox_users` (`mailbox_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `mailboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text NOT NULL,
	`local_part` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mailboxes_domain_id_local_part_unique` ON `mailboxes` (`domain_id`,`local_part`);--> statement-breakpoint
CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`mailbox_id` text NOT NULL,
	`name` text NOT NULL,
	`folder_type` text DEFAULT 'custom' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `folders_mailbox_id_name_unique` ON `folders` (`mailbox_id`,lower("name"));--> statement-breakpoint
CREATE TABLE `message_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`recipient_type` text NOT NULL,
	`display_name` text,
	`email_address` text NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `message_recipients_message_id_idx` ON `message_recipients` (`message_id`);--> statement-breakpoint
CREATE INDEX `message_recipients_message_id_recipient_type_idx` ON `message_recipients` (`message_id`,`recipient_type`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`mailbox_id` text NOT NULL,
	`internet_message_id` text,
	`from_name` text,
	`from_address` text NOT NULL,
	`subject` text NOT NULL,
	`snippet` text NOT NULL,
	`email_date` integer NOT NULL,
	`received_at` integer NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`is_starred` integer DEFAULT false NOT NULL,
	`folder_id` text NOT NULL,
	`folder_entered_at` integer,
	`raw_object_key` text NOT NULL,
	`sync_version` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_mailbox_folder_email_date_idx` ON `messages` (`mailbox_id`,`folder_id`,`email_date`);--> statement-breakpoint
CREATE INDEX `messages_mailbox_updated_at_idx` ON `messages` (`mailbox_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `messages_mailbox_sync_version_idx` ON `messages` (`mailbox_id`,`sync_version`);--> statement-breakpoint
CREATE TABLE `ruleset_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`ruleset_id` text NOT NULL,
	`action_type` text NOT NULL,
	`action_value` text,
	`action_order` integer NOT NULL,
	FOREIGN KEY (`ruleset_id`) REFERENCES `rulesets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ruleset_conditions` (
	`id` text PRIMARY KEY NOT NULL,
	`ruleset_id` text NOT NULL,
	`field` text NOT NULL,
	`match_type` text NOT NULL,
	`condition_value` text NOT NULL,
	`condition_order` integer NOT NULL,
	FOREIGN KEY (`ruleset_id`) REFERENCES `rulesets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rulesets` (
	`id` text PRIMARY KEY NOT NULL,
	`mailbox_id` text NOT NULL,
	`name` text NOT NULL,
	`priority` integer NOT NULL,
	`logic_operator` text DEFAULT 'AND' NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sync_events` (
	`sync_version` integer NOT NULL,
	`mailbox_id` text NOT NULL,
	`event_type` text NOT NULL,
	`message_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_events_mailbox_id_sync_version_unique` ON `sync_events` (`mailbox_id`,`sync_version`);--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
