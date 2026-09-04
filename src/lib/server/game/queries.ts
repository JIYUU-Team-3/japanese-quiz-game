import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { get_db } from '../db/index'
import { choices, players, questions, sessions, topics } from '../db/schema'
import { PLAYABLE_LEVELS, SESSION_MODE, SUPPORTED_FORMAT, TABLE_SIZE } from '#lib/game/types.js'
import type {
	DemoQuestion,
	JlptLevel,
	LeaderboardRow,
	Question,
	QuestionCounts,
	SessionMode,
	Topic,
} from '#lib/game/types.js'

type Db = ReturnType<typeof get_db>

/* ── topics ───────────────────────────────────────────────────────────────── */

export async function listTopics(db: Db): Promise<Topic[]> {
	const rows = await db
		.select()
		.from(topics)
		.where(eq(topics.isActive, true))
		.orderBy(asc(topics.sortOrder), asc(topics.id))

	return rows.map(toTopic)
}

/* ── questions ────────────────────────────────────────────────────────────── */

/**
 * A course's bank, assembled with its choices.
 *
 * Two filters are applied here rather than in the browser, because both are
 * facts about whether an item is answerable at all: the format has to be one
 * the run screen can render, and a question with no correct choice is broken
 * data that would hand the player an unwinnable round.
 */
export async function listQuestions(
	db: Db,
	level: JlptLevel,
	topicId?: number,
): Promise<Question[]> {
	const rows = await db
		.select({ question: questions, topic: topics })
		.from(questions)
		.innerJoin(topics, eq(questions.topicId, topics.id))
		.where(
			and(
				eq(questions.level, level),
				eq(questions.format, SUPPORTED_FORMAT),
				eq(questions.isActive, true),
				topicId === undefined ? undefined : eq(questions.topicId, topicId),
			),
		)
		.orderBy(asc(questions.id))

	if (rows.length === 0) return []

	const choiceRows = await db
		.select()
		.from(choices)
		.where(
			inArray(
				choices.questionId,
				rows.map((r) => r.question.id),
			),
		)
		.orderBy(asc(choices.questionId), asc(choices.position))

	const byQuestion = new Map<number, typeof choiceRows>()
	for (const choice of choiceRows) {
		const bucket = byQuestion.get(choice.questionId)
		if (bucket) bucket.push(choice)
		else byQuestion.set(choice.questionId, [choice])
	}

	return rows
		.map(({ question, topic }) => ({
			id: question.id,
			level: question.level,
			topic: toTopic(topic),
			format: question.format,
			prompt: question.prompt,
			promptFurigana: question.promptFurigana,
			promptEn: question.promptEn,
			audioUrl: question.audioUrl,
			explanation: question.explanation,
			difficulty: question.difficulty,
			choices: (byQuestion.get(question.id) ?? []).map((c) => ({
				id: c.id,
				body: c.body,
				isCorrect: c.isCorrect,
				position: c.position,
			})),
		}))
		.filter((q) => q.choices.some((c) => c.isCorrect))
}

/**
 * Bank size per playable course, counted in the database rather than by
 * shipping every question to a screen that only wants to print a number.
 */
export async function countQuestions(db: Db): Promise<QuestionCounts> {
	const rows = await db
		.select({ level: questions.level, total: sql<number>`count(*)` })
		.from(questions)
		.where(
			and(
				eq(questions.format, SUPPORTED_FORMAT),
				eq(questions.isActive, true),
				inArray(questions.level, [...PLAYABLE_LEVELS]),
			),
		)
		.groupBy(questions.level)

	const counts: QuestionCounts = {}
	for (const level of PLAYABLE_LEVELS) counts[level] = 0
	for (const row of rows) counts[row.level] = Number(row.total)
	return counts
}

/** A handful of questions for the attract reel, with the answer key withheld. */
export async function sampleQuestions(db: Db, limit = 8): Promise<DemoQuestion[]> {
	const rows = await db
		.select({ id: questions.id, prompt: questions.prompt })
		.from(questions)
		.where(
			and(
				eq(questions.format, SUPPORTED_FORMAT),
				eq(questions.isActive, true),
				inArray(questions.level, [...PLAYABLE_LEVELS]),
			),
		)
		.orderBy(sql`random()`)
		.limit(limit)

	if (rows.length === 0) return []

	const choiceRows = await db
		.select({
			questionId: choices.questionId,
			body: choices.body,
			position: choices.position,
		})
		.from(choices)
		.where(
			inArray(
				choices.questionId,
				rows.map((r) => r.id),
			),
		)
		.orderBy(asc(choices.questionId), asc(choices.position))

	const byQuestion = new Map<number, string[]>()
	for (const choice of choiceRows) {
		const bucket = byQuestion.get(choice.questionId)
		if (bucket) bucket.push(choice.body)
		else byQuestion.set(choice.questionId, [choice.body])
	}

	return rows
		.map((row) => ({ id: row.id, prompt: row.prompt, choices: byQuestion.get(row.id) ?? [] }))
		.filter((q) => q.choices.length > 0)
}

/* ── leaderboard ──────────────────────────────────────────────────────────── */

/**
 * The board, read straight off `sessions_leaderboard_idx` (level, mode, score).
 *
 * Only finished runs with a name attached are eligible: an abandoned run and an
 * anonymous one are both real rows, but neither is a claim on the table.
 * Ties break toward the earlier finish, so being first to a score keeps it.
 */
export async function listLeaderboard(
	db: Db,
	level: JlptLevel | null,
	mode: SessionMode = SESSION_MODE,
	limit = TABLE_SIZE,
): Promise<LeaderboardRow[]> {
	const rows = await db
		.select({
			playerName: players.name,
			level: sessions.level,
			mode: sessions.mode,
			score: sessions.score,
			correctCount: sessions.correctCount,
			maxStreak: sessions.maxStreak,
			finishedAt: sessions.finishedAt,
		})
		.from(sessions)
		.innerJoin(players, eq(sessions.playerId, players.id))
		.where(
			and(
				eq(sessions.status, 'finished'),
				eq(sessions.mode, mode),
				level === null ? undefined : eq(sessions.level, level),
			),
		)
		.orderBy(desc(sessions.score), asc(sessions.finishedAt))
		.limit(limit)

	return rows.map((row, i) => ({
		rank: i + 1,
		playerName: row.playerName,
		level: row.level,
		mode: row.mode,
		score: row.score,
		correctCount: row.correctCount,
		maxStreak: row.maxStreak,
		finishedAt: row.finishedAt ? row.finishedAt.getTime() : null,
	}))
}

/**
 * Where a just-recorded run sits on the board, or null if it missed the table.
 *
 * Counted rather than looked up in the returned rows: two players can share a
 * name and a score, and the run that was just written deserves its own answer.
 * The comparison mirrors `listLeaderboard`'s ordering exactly — higher score
 * first, earlier finish on a tie — or the number shown would not be the number
 * the board displays.
 */
export async function rankOfScore(
	db: Db,
	run: { mode: SessionMode; score: number; finishedAt: Date },
	limit = TABLE_SIZE,
): Promise<number | null> {
	const [row] = await db
		.select({ ahead: sql<number>`count(*)` })
		.from(sessions)
		.innerJoin(players, eq(sessions.playerId, players.id))
		.where(
			and(
				eq(sessions.status, 'finished'),
				eq(sessions.mode, run.mode),
				sql`(${sessions.score} > ${run.score} or (${sessions.score} = ${run.score} and ${sessions.finishedAt} < ${Math.floor(run.finishedAt.getTime() / 1000)}))`,
			),
		)

	const rank = Number(row?.ahead ?? 0) + 1
	return rank <= limit ? rank : null
}

/* ── shared mapping ───────────────────────────────────────────────────────── */

function toTopic(row: typeof topics.$inferSelect): Topic {
	return {
		id: row.id,
		slug: row.slug,
		nameEn: row.nameEn,
		nameJa: row.nameJa,
		minLevel: row.minLevel,
		sortOrder: row.sortOrder,
	}
}
