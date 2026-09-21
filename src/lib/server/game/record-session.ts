import { and, eq, getTableColumns, inArray, sql } from 'drizzle-orm'
import { choices, players, questions, sessionAnswers, sessions } from '../db/schema'
import { listLeaderboard, rankOfScore } from './queries'
import { clampElapsed, tally } from '#lib/game/scoring.js'
import {
	NAME_CHARS,
	NAME_MAX,
	PLAYABLE_LEVELS,
	SESSION_MODE,
	jlptLevels,
	sessionModes,
	type JlptLevel,
	type RecordedAnswer,
	type SessionMode,
	type SessionSubmission,
	type SubmitResponse,
} from '#lib/game/types.js'

/**
 * A run cannot post an unbounded answer log. Three lives against a ten-second
 * clock puts a real run in the tens of answers; the ceiling exists so a
 * malformed or hostile body cannot turn one POST into thousands of writes.
 */
const MAX_ANSWERS = 300

/** D1 refuses a statement that binds more than this many parameters. */
export const D1_MAX_BOUND_PARAMS = 100

/**
 * Answer rows per INSERT, derived from the column count so a new column on
 * `session_answers` cannot silently push a long run past D1's limit.
 */
export const INSERT_CHUNK = Math.floor(
	D1_MAX_BOUND_PARAMS / Object.keys(getTableColumns(sessionAnswers)).length,
)

const NAME_ALPHABET = new Set(NAME_CHARS)

export class SubmissionError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message)
		this.name = 'SubmissionError'
	}
}

/**
 * Records a finished run and returns what was actually written.
 *
 * The client's own score never enters this function — `SessionSubmission`
 * does not carry one. Every answer is regraded against `choices.is_correct`,
 * the streak and multiplier are replayed from those verdicts, and the score
 * that lands on the board is the one computed here. The browser still holds
 * the answer key (it has to, to show `せいかい！` the instant a player taps),
 * so this is not a defence against a determined cheat — it is what stops the
 * board being editable with a single hand-written `fetch`.
 */
export async function recordSession(locals: App.Locals, body: unknown): Promise<SubmitResponse> {
	const submission = parseSubmission(body)
	const { db } = locals

	/* ── grade ────────────────────────────────────────────────────────────── */

	const questionIds = [...new Set(submission.answers.map((a) => a.questionId))]

	// Both lookups are scoped to the claimed course. A submission that names a
	// question from another level is not scored badly, it is refused: Level is a
	// promise, and an N3 item banked against the N4 board would break it.
	const asked = questionIds.length
		? await db
				.select({ id: questions.id })
				.from(questions)
				.where(and(inArray(questions.id, questionIds), eq(questions.level, submission.level)))
		: []

	if (asked.length !== questionIds.length) {
		throw new SubmissionError(422, 'Submission references questions outside the chosen course.')
	}

	const correctChoices = questionIds.length
		? await db
				.select({ id: choices.id, questionId: choices.questionId })
				.from(choices)
				.where(and(inArray(choices.questionId, questionIds), eq(choices.isCorrect, true)))
		: []

	const answerKey = new Map<number, Set<number>>()
	for (const choice of correctChoices) {
		const bucket = answerKey.get(choice.questionId)
		if (bucket) bucket.add(choice.id)
		else answerKey.set(choice.questionId, new Set([choice.id]))
	}

	const graded = submission.answers.map((answer) => ({
		...answer,
		answerMs: clampElapsed(answer.answerMs),
		// A null choice is a timeout, and a timeout is wrong by definition.
		correct:
			answer.choiceId !== null && (answerKey.get(answer.questionId)?.has(answer.choiceId) ?? false),
	}))

	const result = tally(graded)

	/* ── write ────────────────────────────────────────────────────────────── */

	// Player, session and answers go to D1 as one batch, which D1 runs as a
	// single transaction. Written one by one, a failure part-way left a finished,
	// scored session with no answers on the board — and every retry added another.
	const finishedAt = new Date()
	const sessionId = crypto.randomUUID()

	// A fresh player row per run, deliberately. A name here is a string on a
	// score, not an identity the system recognises across runs, so two runs by
	// the same person under the same name are two unrelated rows.
	const insertPlayer = db.insert(players).values({
		name: submission.playerName,
		createdAt: finishedAt,
	})

	const insertSession = db.insert(sessions).values({
		id: sessionId,
		// The batch shares one connection, so this is the player row just above.
		playerId: sql`last_insert_rowid()`,
		level: submission.level,
		mode: submission.mode,
		topicId: submission.topicId,
		status: submission.status,
		questionCount: result.questionCount,
		correctCount: result.correctCount,
		wrongCount: result.wrongCount,
		maxStreak: result.maxStreak,
		score: result.score,
		durationMs: submission.durationMs,
		startedAt: new Date(finishedAt.getTime() - submission.durationMs),
		finishedAt,
	})

	const answerRows = graded.map((answer, position) => ({
		sessionId,
		position,
		questionId: answer.questionId,
		choiceId: answer.choiceId,
		isCorrect: answer.correct,
		answerMs: answer.answerMs,
		points: result.points[position],
		answeredAt: finishedAt,
	}))

	const insertAnswers = []
	for (let i = 0; i < answerRows.length; i += INSERT_CHUNK) {
		insertAnswers.push(db.insert(sessionAnswers).values(answerRows.slice(i, i + INSERT_CHUNK)))
	}

	await db.batch([insertPlayer, insertSession, ...insertAnswers])

	/* ── read back ────────────────────────────────────────────────────────── */

	// The board is re-read rather than patched, so the rank the player is shown
	// on GAME OVER is the rank the next visitor to /ranking will see.
	const [table, rank] = await Promise.all([
		listLeaderboard(db, null, submission.mode),
		rankOfScore(db, { mode: submission.mode, score: result.score, finishedAt }),
	])

	return {
		recorded: {
			sessionId,
			questionCount: result.questionCount,
			correctCount: result.correctCount,
			wrongCount: result.wrongCount,
			maxStreak: result.maxStreak,
			score: result.score,
			rank,
		},
		table,
	}
}

/* ── validation ───────────────────────────────────────────────────────────── */

/**
 * Turns an untrusted request body into a `SessionSubmission` or refuses it.
 *
 * Everything a POST can influence is checked here, because past this point the
 * values reach the database. Nothing is coerced silently into a plausible
 * default — a malformed run is rejected rather than recorded as a strange one.
 */
export function parseSubmission(body: unknown): SessionSubmission {
	if (typeof body !== 'object' || body === null) {
		throw new SubmissionError(400, 'Expected a JSON object.')
	}
	const raw = body as Record<string, unknown>

	const playerName = normaliseName(raw.playerName)
	if (playerName.length === 0) {
		throw new SubmissionError(400, 'A name is required.')
	}

	const level = raw.level
	if (!isLevel(level) || !PLAYABLE_LEVELS.includes(level)) {
		throw new SubmissionError(400, `level must be one of ${PLAYABLE_LEVELS.join(', ')}.`)
	}

	const mode = raw.mode === undefined ? SESSION_MODE : raw.mode
	if (!isMode(mode)) {
		throw new SubmissionError(400, `mode must be one of ${sessionModes.join(', ')}.`)
	}

	const status = raw.status === undefined ? 'finished' : raw.status
	if (status !== 'finished' && status !== 'abandoned') {
		throw new SubmissionError(400, "status must be 'finished' or 'abandoned'.")
	}

	const topicId = raw.topicId ?? null
	if (topicId !== null && !isPositiveInt(topicId)) {
		throw new SubmissionError(400, 'topicId must be a positive integer or null.')
	}

	const durationMs = raw.durationMs
	if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
		throw new SubmissionError(400, 'durationMs must be a non-negative number.')
	}

	if (!Array.isArray(raw.answers)) {
		throw new SubmissionError(400, 'answers must be an array.')
	}
	if (raw.answers.length === 0) {
		throw new SubmissionError(422, 'A run with no answers is not a run.')
	}
	if (raw.answers.length > MAX_ANSWERS) {
		throw new SubmissionError(413, `A run may hold at most ${MAX_ANSWERS} answers.`)
	}

	const answers = raw.answers.map((entry, i): RecordedAnswer => {
		if (typeof entry !== 'object' || entry === null) {
			throw new SubmissionError(400, `answers[${i}] must be an object.`)
		}
		const answer = entry as Record<string, unknown>
		if (!isPositiveInt(answer.questionId)) {
			throw new SubmissionError(400, `answers[${i}].questionId must be a positive integer.`)
		}
		const choiceId = answer.choiceId ?? null
		if (choiceId !== null && !isPositiveInt(choiceId)) {
			throw new SubmissionError(400, `answers[${i}].choiceId must be a positive integer or null.`)
		}
		if (typeof answer.answerMs !== 'number') {
			throw new SubmissionError(400, `answers[${i}].answerMs must be a number.`)
		}
		return { questionId: answer.questionId, choiceId, answerMs: answer.answerMs }
	})

	return {
		playerName,
		level,
		mode,
		topicId: topicId as number | null,
		status,
		durationMs: Math.round(durationMs),
		answers,
	}
}

/**
 * The cabinet's character set, enforced server-side.
 *
 * The name-entry pad only offers these glyphs, but the pad is not the only way
 * to reach this endpoint, and the board is read by other players. Anything
 * outside the alphabet is dropped rather than escaped, which also settles the
 * question of what a name can contain when it is rendered on a page.
 */
function normaliseName(value: unknown): string {
	if (typeof value !== 'string') return ''
	return [...value.toUpperCase()]
		.filter((char) => NAME_ALPHABET.has(char))
		.slice(0, NAME_MAX)
		.join('')
}

function isLevel(value: unknown): value is JlptLevel {
	return typeof value === 'string' && (jlptLevels as readonly string[]).includes(value)
}

function isMode(value: unknown): value is SessionMode {
	return typeof value === 'string' && (sessionModes as readonly string[]).includes(value)
}

function isPositiveInt(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0
}
