/**
 * The scoring rules, in one plain module because two very different places
 * need them and must agree to the point.
 *
 * The browser runs them live so the player sees `+1,450` land the instant they
 * tap, and the server runs them again over the posted answers before anything
 * reaches the leaderboard. If the two ever drifted, an honest player would see
 * one number on GAME OVER and a different one on the board.
 *
 * This file must stay free of Svelte runes and of `drizzle-orm`: `run.svelte.ts`
 * imports it into the browser bundle and `src/lib/server/game/` imports it into
 * the worker.
 */

/** The clock every question gets. Never carried forward between questions. */
export const QUESTION_MS = 10_000
export const START_LIVES = 3
export const MAX_MULTIPLIER = 5

const BASE_POINTS = 100

/**
 * Milliseconds spent on one question, forced into the only range a real answer
 * can occupy. A submission claiming it answered in negative time is scored as
 * though it took the full ten seconds, not as though it were instant — the
 * clamp has to fail toward the smaller number or it becomes the exploit.
 */
export function clampElapsed(answerMs: number): number {
	// Negative and non-finite times are not slow answers, they are impossible
	// ones, and they are scored as the full ten seconds rather than folded to
	// zero. Folding to zero would hand a forged submission the largest time
	// bonus on the board, which is the opposite of what a clamp is for.
	if (!Number.isFinite(answerMs) || answerMs < 0) return QUESTION_MS
	return Math.min(QUESTION_MS, Math.round(answerMs))
}

/**
 * The multiplier the NEXT correct answer banks at, given the streak standing
 * before it. Two in a row to move it, capped at five.
 */
export function multiplierFor(streak: number): number {
	return Math.min(1 + Math.floor(Math.max(0, streak) / 2), MAX_MULTIPLIER)
}

/**
 * Points for one correct answer. `answerMs` is time spent, not time left, so
 * the server can score straight from the `session_answers.answer_ms` column it
 * stored rather than from a figure the client handed it.
 */
export function pointsFor(answerMs: number, streak: number): number {
	const remaining = QUESTION_MS - clampElapsed(answerMs)
	return (BASE_POINTS + Math.floor(remaining / 100)) * multiplierFor(streak)
}

/** One graded run, replayed from its answers in play order. */
export interface Tally {
	questionCount: number
	correctCount: number
	wrongCount: number
	maxStreak: number
	score: number
	/** Points banked per answer, aligned to the input order. */
	points: number[]
}

/**
 * Replays a run's verdicts through the scoring rules. The server grades each
 * answer against the database first, then hands the whole sequence here — so
 * the streak and the multiplier are rebuilt from what actually happened rather
 * than read off the submission.
 */
export function tally(answers: readonly { correct: boolean; answerMs: number }[]): Tally {
	let score = 0
	let streak = 0
	let maxStreak = 0
	let correctCount = 0
	const points: number[] = []

	for (const answer of answers) {
		if (answer.correct) {
			const gain = pointsFor(answer.answerMs, streak)
			points.push(gain)
			score += gain
			streak += 1
			maxStreak = Math.max(maxStreak, streak)
			correctCount += 1
		} else {
			points.push(0)
			streak = 0
		}
	}

	return {
		questionCount: answers.length,
		correctCount,
		wrongCount: answers.length - correctCount,
		maxStreak,
		score,
		points,
	}
}
