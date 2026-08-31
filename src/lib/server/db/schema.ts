import { relations } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const jlpt_levels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export const question_formats = ['multiple_choices', 'true_false'] as const
export const session_modes = ['lesson', 'final'] as const
export const session_statuses = ['not_started', 'in_progress', 'completed'] as const

export const topics = sqliteTable('topics', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	slug: text('slug', { length: 32 }).notNull().unique(),
	name_en: text('name_en').notNull(),
	name_ja: text('name_ja').notNull(),
	min_level: text('min_level', { enum: jlpt_levels }).notNull(),
	sort_order: integer('sort_order').notNull(),
	is_active: integer('is_active', { mode: 'boolean' }).notNull(),
})

export const players = sqliteTable('players', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	created_at: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const questions = sqliteTable('questions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	level: text('level', { enum: jlpt_levels }).notNull(),
	topic_id: integer('topic_id')
		.notNull()
		.references(() => topics.id),
	format: text('format', { enum: question_formats }).notNull(),
	prompt: text('prompt').notNull(),
	prompt_furigana: text('prompt_furigana'),
	prompt_en: text('prompt_en'),
	audio_url: text('audio_url'),
	explanation: text('explanation'),
	difficulty: integer('difficulty').notNull(),
	is_active: integer('is_active', { mode: 'boolean' }).notNull(),
	created_at: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const choices = sqliteTable('choices', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	question_id: integer('question_id')
		.notNull()
		.references(() => questions.id),
	body: text('body').notNull(),
	is_correct: integer('is_correct', { mode: 'boolean' }).notNull(),
	position: integer('position').notNull(),
})

export const sessions = sqliteTable('sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	player_id: integer('player_id').references(() => players.id),
	level: text('level', { enum: jlpt_levels }).notNull(),
	mode: text('mode', { enum: session_modes }).notNull(),
	topic_id: integer('topic_id').references(() => topics.id),
	status: text('status', { enum: session_statuses }).notNull(),
	question_count: integer('question_count').notNull(),
	correct_count: integer('correct_count').notNull(),
	wrong_count: integer('wrong_count').notNull(),
	max_streak: integer('max_streak').notNull(),
	score: integer('score').notNull(),
	duration_ms: integer('duration_ms'),
	started_at: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
	finished_at: integer('finished_at', { mode: 'timestamp_ms' }),
})

export const session_answers = sqliteTable(
	'session_answers',
	{
		session_id: text('session_id')
			.notNull()
			.references(() => sessions.id),
		position: integer('position').notNull(),
		question_id: integer('question_id')
			.notNull()
			.references(() => questions.id),
		choice_id: integer('choice_id').references(() => choices.id),
		is_correct: integer('is_correct', { mode: 'boolean' }).notNull(),
		answer_ms: integer('answer_ms'),
		points: integer('points').notNull(),
		answered_at: integer('answered_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(table) => [primaryKey({ columns: [table.session_id, table.position] })],
)

export const topics_relations = relations(topics, ({ many }) => ({
	questions: many(questions),
	sessions: many(sessions),
}))

export const players_relations = relations(players, ({ many }) => ({
	sessions: many(sessions),
}))

export const questions_relations = relations(questions, ({ one, many }) => ({
	topic: one(topics, { fields: [questions.topic_id], references: [topics.id] }),
	choices: many(choices),
	session_answers: many(session_answers),
}))

export const choices_relations = relations(choices, ({ one, many }) => ({
	question: one(questions, { fields: [choices.question_id], references: [questions.id] }),
	session_answers: many(session_answers),
}))

export const sessions_relations = relations(sessions, ({ one, many }) => ({
	player: one(players, { fields: [sessions.player_id], references: [players.id] }),
	topic: one(topics, { fields: [sessions.topic_id], references: [topics.id] }),
	answers: many(session_answers),
}))

export const session_answers_relations = relations(session_answers, ({ one }) => ({
	session: one(sessions, { fields: [session_answers.session_id], references: [sessions.id] }),
	question: one(questions, { fields: [session_answers.question_id], references: [questions.id] }),
	choice: one(choices, { fields: [session_answers.choice_id], references: [choices.id] }),
}))
