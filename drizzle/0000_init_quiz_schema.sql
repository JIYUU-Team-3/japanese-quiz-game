CREATE TABLE `choices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`body` text NOT NULL,
	`is_correct` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "choices_position_check" CHECK("choices"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `choices_question_id_position_unique` ON `choices` (`question_id`,`position`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`level` text NOT NULL,
	`topic_id` integer NOT NULL,
	`format` text DEFAULT 'multiple_choice' NOT NULL,
	`prompt` text NOT NULL,
	`prompt_furigana` text,
	`prompt_en` text,
	`audio_url` text,
	`explanation` text,
	`difficulty` integer DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "questions_level_check" CHECK("questions"."level" in ('N5', 'N4', 'N3', 'N2', 'N1')),
	CONSTRAINT "questions_format_check" CHECK("questions"."format" in ('multiple_choice', 'true_false', 'audio', 'typing'))
);
--> statement-breakpoint
CREATE INDEX `questions_topic_id_idx` ON `questions` (`topic_id`);--> statement-breakpoint
CREATE INDEX `questions_pick_idx` ON `questions` (`level`,`topic_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `session_answers` (
	`session_id` text NOT NULL,
	`position` integer NOT NULL,
	`question_id` integer NOT NULL,
	`choice_id` integer,
	`is_correct` integer DEFAULT false NOT NULL,
	`answer_ms` integer,
	`points` integer DEFAULT 0 NOT NULL,
	`answered_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`session_id`, `position`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`choice_id`) REFERENCES `choices`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "session_answers_position_check" CHECK("session_answers"."position" >= 0)
);
--> statement-breakpoint
CREATE INDEX `session_answers_question_id_idx` ON `session_answers` (`question_id`);--> statement-breakpoint
CREATE INDEX `session_answers_choice_id_idx` ON `session_answers` (`choice_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` integer NOT NULL,
	`level` text NOT NULL,
	`mode` text DEFAULT 'practice' NOT NULL,
	`topic_id` integer,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`question_count` integer DEFAULT 0 NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`wrong_count` integer DEFAULT 0 NOT NULL,
	`max_streak` integer DEFAULT 0 NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "sessions_level_check" CHECK("sessions"."level" in ('N5', 'N4', 'N3', 'N2', 'N1')),
	CONSTRAINT "sessions_mode_check" CHECK("sessions"."mode" in ('practice', 'timed', 'survival')),
	CONSTRAINT "sessions_status_check" CHECK("sessions"."status" in ('in_progress', 'finished', 'abandoned'))
);
--> statement-breakpoint
CREATE INDEX `sessions_player_id_idx` ON `sessions` (`player_id`);--> statement-breakpoint
CREATE INDEX `sessions_topic_id_idx` ON `sessions` (`topic_id`);--> statement-breakpoint
CREATE INDEX `sessions_leaderboard_idx` ON `sessions` (`level`,`mode`,`score`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text(32) NOT NULL,
	`name_en` text NOT NULL,
	`name_ja` text NOT NULL,
	`min_level` text DEFAULT 'N5' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	CONSTRAINT "topics_min_level_check" CHECK("topics"."min_level" in ('N5', 'N4', 'N3', 'N2', 'N1'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_slug_unique` ON `topics` (`slug`);--> statement-breakpoint
CREATE INDEX `topics_sort_order_idx` ON `topics` (`sort_order`);