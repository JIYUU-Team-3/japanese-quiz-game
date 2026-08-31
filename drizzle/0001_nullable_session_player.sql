PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` integer,
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
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "sessions_level_check" CHECK("__new_sessions"."level" in ('N5', 'N4', 'N3', 'N2', 'N1')),
	CONSTRAINT "sessions_mode_check" CHECK("__new_sessions"."mode" in ('practice', 'timed', 'survival')),
	CONSTRAINT "sessions_status_check" CHECK("__new_sessions"."status" in ('in_progress', 'finished', 'abandoned'))
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "player_id", "level", "mode", "topic_id", "status", "question_count", "correct_count", "wrong_count", "max_streak", "score", "duration_ms", "started_at", "finished_at") SELECT "id", "player_id", "level", "mode", "topic_id", "status", "question_count", "correct_count", "wrong_count", "max_streak", "score", "duration_ms", "started_at", "finished_at" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sessions_player_id_idx` ON `sessions` (`player_id`);--> statement-breakpoint
CREATE INDEX `sessions_topic_id_idx` ON `sessions` (`topic_id`);--> statement-breakpoint
CREATE INDEX `sessions_leaderboard_idx` ON `sessions` (`level`,`mode`,`score`);