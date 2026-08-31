CREATE TABLE `choices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`body` text NOT NULL,
	`is_correct` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_name_unique` ON `players` (`name`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`level` text NOT NULL,
	`topic_id` integer NOT NULL,
	`format` text NOT NULL,
	`prompt` text NOT NULL,
	`prompt_furigana` text,
	`prompt_en` text,
	`audio_url` text,
	`explanation` text,
	`difficulty` integer NOT NULL,
	`is_active` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session_answers` (
	`session_id` text NOT NULL,
	`position` integer NOT NULL,
	`question_id` integer NOT NULL,
	`choice_id` integer,
	`is_correct` integer NOT NULL,
	`answer_ms` integer,
	`points` integer NOT NULL,
	`answered_at` integer NOT NULL,
	PRIMARY KEY(`session_id`, `position`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`choice_id`) REFERENCES `choices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` integer,
	`level` text NOT NULL,
	`mode` text NOT NULL,
	`topic_id` integer,
	`status` text NOT NULL,
	`question_count` integer NOT NULL,
	`correct_count` integer NOT NULL,
	`wrong_count` integer NOT NULL,
	`max_streak` integer NOT NULL,
	`score` integer NOT NULL,
	`duration_ms` integer,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text(32) NOT NULL,
	`name_en` text NOT NULL,
	`name_ja` text NOT NULL,
	`min_level` text NOT NULL,
	`sort_order` integer NOT NULL,
	`is_active` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_slug_unique` ON `topics` (`slug`);