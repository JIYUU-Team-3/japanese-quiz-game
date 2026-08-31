import { relations, sql } from 'drizzle-orm'
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from 'drizzle-orm/sqlite-core'

/* ------------------------------------------------------------------ *
 * Enums. SQLite/D1 has no native enum type, so these are TEXT columns
 * whose allowed values are declared here and enforced by the CHECK
 * constraints added in the migration.
 * ------------------------------------------------------------------ */

export const jlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export const questionFormats = ['multiple_choice', 'true_false', 'audio', 'typing'] as const
export const sessionModes = ['practice', 'timed', 'survival'] as const
export const sessionStatuses = ['in_progress', 'finished', 'abandoned'] as const

export type JlptLevel = (typeof jlptLevels)[number]
export type QuestionFormat = (typeof questionFormats)[number]
export type SessionMode = (typeof sessionModes)[number]
export type SessionStatus = (typeof sessionStatuses)[number]

const now = sql`(unixepoch())`

/* ------------------------------------------------------------------ *
 * topics
 * ------------------------------------------------------------------ */

export const topics = sqliteTable(
	'topics',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		slug: text('slug', { length: 32 }).notNull(),
		nameEn: text('name_en').notNull(),
		nameJa: text('name_ja').notNull(),
		minLevel: text('min_level', { enum: jlptLevels }).notNull().default('N5'),
		sortOrder: integer('sort_order').notNull().default(0),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	},
	(t) => [
		uniqueIndex('topics_slug_unique').on(t.slug),
		index('topics_sort_order_idx').on(t.sortOrder),
		check('topics_min_level_check', sql`${t.minLevel} in ('N5', 'N4', 'N3', 'N2', 'N1')`),
	],
)

/* ------------------------------------------------------------------ *
 * players
 * ------------------------------------------------------------------ */

export const players = sqliteTable('players', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
})

/* ------------------------------------------------------------------ *
 * questions
 * ------------------------------------------------------------------ */

export const questions = sqliteTable(
	'questions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		level: text('level', { enum: jlptLevels }).notNull(),
		topicId: integer('topic_id')
			.notNull()
			.references(() => topics.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
		format: text('format', { enum: questionFormats }).notNull().default('multiple_choice'),
		prompt: text('prompt').notNull(),
		promptFurigana: text('prompt_furigana'),
		promptEn: text('prompt_en'),
		audioUrl: text('audio_url'),
		explanation: text('explanation'),
		difficulty: integer('difficulty').notNull().default(1),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
	},
	(t) => [
		index('questions_topic_id_idx').on(t.topicId),
		index('questions_pick_idx').on(t.level, t.topicId, t.isActive),
		check('questions_level_check', sql`${t.level} in ('N5', 'N4', 'N3', 'N2', 'N1')`),
		check(
			'questions_format_check',
			sql`${t.format} in ('multiple_choice', 'true_false', 'audio', 'typing')`,
		),
	],
)

/* ------------------------------------------------------------------ *
 * choices
 * ------------------------------------------------------------------ */

export const choices = sqliteTable(
	'choices',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		questionId: integer('question_id')
			.notNull()
			.references(() => questions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		body: text('body').notNull(),
		isCorrect: integer('is_correct', { mode: 'boolean' }).notNull().default(false),
		position: integer('position').notNull(),
	},
	(t) => [
		uniqueIndex('choices_question_id_position_unique').on(t.questionId, t.position),
		check('choices_position_check', sql`${t.position} >= 0`),
	],
)

/* ------------------------------------------------------------------ *
 * sessions
 * ------------------------------------------------------------------ */

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		playerId: integer('player_id').references(() => players.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		level: text('level', { enum: jlptLevels }).notNull(),
		mode: text('mode', { enum: sessionModes }).notNull().default('practice'),
		topicId: integer('topic_id').references(() => topics.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		status: text('status', { enum: sessionStatuses }).notNull().default('in_progress'),
		questionCount: integer('question_count').notNull().default(0),
		correctCount: integer('correct_count').notNull().default(0),
		wrongCount: integer('wrong_count').notNull().default(0),
		maxStreak: integer('max_streak').notNull().default(0),
		score: integer('score').notNull().default(0),
		durationMs: integer('duration_ms'),
		startedAt: integer('started_at', { mode: 'timestamp' }).notNull().default(now),
		finishedAt: integer('finished_at', { mode: 'timestamp' }),
	},
	(t) => [
		index('sessions_player_id_idx').on(t.playerId),
		index('sessions_topic_id_idx').on(t.topicId),
		index('sessions_leaderboard_idx').on(t.level, t.mode, t.score),
		check('sessions_level_check', sql`${t.level} in ('N5', 'N4', 'N3', 'N2', 'N1')`),
		check('sessions_mode_check', sql`${t.mode} in ('practice', 'timed', 'survival')`),
		check('sessions_status_check', sql`${t.status} in ('in_progress', 'finished', 'abandoned')`),
	],
)

/* ------------------------------------------------------------------ *
 * session_answers
 * ------------------------------------------------------------------ */

export const sessionAnswers = sqliteTable(
	'session_answers',
	{
		sessionId: text('session_id')
			.notNull()
			.references(() => sessions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		position: integer('position').notNull(),
		questionId: integer('question_id')
			.notNull()
			.references(() => questions.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
		choiceId: integer('choice_id').references(() => choices.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		isCorrect: integer('is_correct', { mode: 'boolean' }).notNull().default(false),
		answerMs: integer('answer_ms'),
		points: integer('points').notNull().default(0),
		answeredAt: integer('answered_at', { mode: 'timestamp' }).notNull().default(now),
	},
	(t) => [
		primaryKey({ columns: [t.sessionId, t.position] }),
		index('session_answers_question_id_idx').on(t.questionId),
		index('session_answers_choice_id_idx').on(t.choiceId),
		check('session_answers_position_check', sql`${t.position} >= 0`),
	],
)

/* ------------------------------------------------------------------ *
 * relations
 * ------------------------------------------------------------------ */

export const topicsRelations = relations(topics, ({ many }) => ({
	questions: many(questions),
	sessions: many(sessions),
}))

export const playersRelations = relations(players, ({ many }) => ({
	sessions: many(sessions),
}))

export const questionsRelations = relations(questions, ({ one, many }) => ({
	topic: one(topics, { fields: [questions.topicId], references: [topics.id] }),
	choices: many(choices),
	answers: many(sessionAnswers),
}))

export const choicesRelations = relations(choices, ({ one }) => ({
	question: one(questions, { fields: [choices.questionId], references: [questions.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
	player: one(players, { fields: [sessions.playerId], references: [players.id] }),
	topic: one(topics, { fields: [sessions.topicId], references: [topics.id] }),
	answers: many(sessionAnswers),
}))

export const sessionAnswersRelations = relations(sessionAnswers, ({ one }) => ({
	session: one(sessions, { fields: [sessionAnswers.sessionId], references: [sessions.id] }),
	question: one(questions, { fields: [sessionAnswers.questionId], references: [questions.id] }),
	choice: one(choices, { fields: [sessionAnswers.choiceId], references: [choices.id] }),
}))
