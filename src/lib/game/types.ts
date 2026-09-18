/**
 * Client-side DTOs mirroring `src/lib/server/db/schema.ts`.
 *
 * These are hand-written rather than inferred from Drizzle on purpose: the
 * schema module imports `drizzle-orm` and belongs to the server bundle, and
 * pulling it into components would drag the ORM into the browser. Keep the
 * shapes here in step with the schema by hand — the enums below are copied
 * verbatim from it.
 */

export const jlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export const questionFormats = ['multiple_choice', 'true_false', 'audio', 'typing'] as const
export const sessionModes = ['practice', 'timed', 'survival'] as const
export const sessionStatuses = ['in_progress', 'finished', 'abandoned'] as const

export type JlptLevel = (typeof jlptLevels)[number]
export type QuestionFormat = (typeof questionFormats)[number]
export type SessionMode = (typeof sessionModes)[number]
export type SessionStatus = (typeof sessionStatuses)[number]

/**
 * The levels this game actually offers. The schema supports all five JLPT
 * levels; PRODUCT.md scopes the product to N4 and N3, so the UI offers those
 * and nothing else. Widening the game is a product decision, not a data one.
 */
export const PLAYABLE_LEVELS: readonly JlptLevel[] = ['N4', 'N3']

/**
 * The one format the run screen can render. Anything else is filtered out
 * before it reaches the player rather than crashing the run.
 */
export const SUPPORTED_FORMAT: QuestionFormat = 'multiple_choice'

/**
 * This game ends when the third life is lost, not when a clock expires, so
 * runs are recorded as `survival`. The per-question timer is a pressure
 * device inside that mode, not the mode itself. Leaderboards are indexed on
 * (level, mode, score), so this value decides which scores compete together.
 */
export const SESSION_MODE: SessionMode = 'survival'

/**
 * How many rows the high-score table holds. Both the reader and the UI need
 * this number, so it lives with the shapes rather than in either one.
 */
export const TABLE_SIZE = 10

/** Longest name that fits on the board. */
export const NAME_MAX = 6

/**
 * The arcade character set, in cabinet order.
 *
 * The name-entry pad renders from this list and the server filters submitted
 * names against it, which is why it sits here and not in the component: a name
 * is read by other players, so what a name may contain is a rule, not a widget.
 */
export const NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-'.split('')

export interface Topic {
	id: number
	slug: string
	nameEn: string
	nameJa: string
	minLevel: JlptLevel
	sortOrder: number
}

export interface Choice {
	id: number
	body: string
	isCorrect: boolean
	position: number
}

export interface Question {
	id: number
	level: JlptLevel
	topic: Topic
	format: QuestionFormat
	prompt: string
	promptFurigana: string | null
	promptEn: string | null
	audioUrl: string | null
	explanation: string | null
	difficulty: number
	/** Ordered by `position`. Length is not guaranteed to be four. */
	choices: Choice[]
}

export interface ReviewItem {
	question: Question
	selectedChoice: Choice | null
	correctChoice: Choice
	isCorrect: boolean
	timedOut: boolean
	answerMs: number
	roundNumber?: number
}

/**
 * One answered question, as the run logs it. Maps onto a `session_answers` row.
 *
 * `choiceId` is null when the clock ran out — the schema allows it, and a
 * timeout is a real recorded event, not a missing one. `answerMs` is time
 * SPENT, which is what the column stores and what the server rescores from.
 */
export interface RecordedAnswer {
	questionId: number
	choiceId: number | null
	answerMs: number
}

/**
 * What a finished run posts back.
 *
 * Deliberately carries no score, no counts and no streak. The server grades
 * `answers` against `choices.is_correct` and rebuilds every one of those
 * numbers itself; a client that could name its own score could name any score.
 * The run's own tally is still shown on GAME OVER — it is just not the number
 * that reaches the board.
 */
export interface SessionSubmission {
	playerName: string
	level: JlptLevel
	mode: SessionMode
	topicId: number | null
	status: Extract<SessionStatus, 'finished' | 'abandoned'>
	durationMs: number
	/** In play order. Position in this array becomes `session_answers.position`. */
	answers: RecordedAnswer[]
}

/** The server's own count of a run, returned so the UI can show what was recorded. */
export interface RecordedSession {
	sessionId: string
	questionCount: number
	correctCount: number
	wrongCount: number
	maxStreak: number
	score: number
	/** Where the run landed on the board, or null if it missed the table. */
	rank: number | null
}

/** The answer to a POST of a finished run: what was recorded, and the new board. */
export interface SubmitResponse {
	recorded: RecordedSession
	table: LeaderboardRow[]
}

/** One row of the board. `rank` is assigned by the reader, not stored. */
export interface LeaderboardRow {
	rank: number
	playerName: string
	level: JlptLevel
	mode: SessionMode
	score: number
	correctCount: number
	maxStreak: number
	/** Epoch ms, or null for a preset factory row. */
	finishedAt: number | null
}

/** How many playable questions each course holds. Drives the SELECT COURSE screen. */
export type QuestionCounts = Partial<Record<JlptLevel, number>>

/**
 * A question stripped down for the attract screen's demo reel.
 *
 * The title screen shows a question nobody is answering, so it is served
 * without `isCorrect` — there is no reason to publish an answer key to a page
 * that has no way to accept an answer.
 */
export interface DemoQuestion {
	id: number
	prompt: string
	choices: string[]
}
