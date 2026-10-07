CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation` text NOT NULL,
	`sender_id` text NOT NULL,
	`sender_name` text NOT NULL,
	`sender_re` text,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`client_key` text NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `chat_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_messages_conversation_id` ON `chat_messages` (`conversation`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chat_messages_sender_key_unique` ON `chat_messages` (`sender_id`,`client_key`);--> statement-breakpoint
CREATE TABLE `chat_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`re` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_profiles_re_unique` ON `chat_profiles` (`re`);--> statement-breakpoint
CREATE TABLE `chat_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_a` text NOT NULL,
	`user_b` text NOT NULL,
	FOREIGN KEY (`user_a`) REFERENCES `chat_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_b`) REFERENCES `chat_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_threads_pair_unique` ON `chat_threads` (`user_a`,`user_b`);