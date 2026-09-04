import { describe, expect, it } from 'vitest'
import {
	MAX_MULTIPLIER,
	QUESTION_MS,
	clampElapsed,
	multiplierFor,
	pointsFor,
	tally,
} from './scoring'

/**
 * These rules are the contract between the browser and the worker: the run
 * screen scores a tap live, and `record-session.ts` scores the same answer
 * again from the stored `answer_ms`. Anything that drifts here shows up as a
 * player watching one number on GAME OVER and a different one on the board.
 */

describe('clampElapsed', () => {
	it('rounds a real answer time to whole milliseconds', () => {
		expect(clampElapsed(2000.6)).toBe(2001)
	})

	it('caps an over-long answer at the question clock', () => {
		expect(clampElapsed(99_999)).toBe(QUESTION_MS)
	})

	it('scores impossible times as the full clock, never as instant', () => {
		// Folding a negative to zero would hand a forged submission the largest
		// time bonus available, which is the exploit this exists to close.
		expect(clampElapsed(-1)).toBe(QUESTION_MS)
		expect(clampElapsed(Number.NaN)).toBe(QUESTION_MS)
		expect(clampElapsed(Number.NEGATIVE_INFINITY)).toBe(QUESTION_MS)
	})

	it('leaves a genuinely instant answer alone', () => {
		expect(clampElapsed(0)).toBe(0)
	})
})

describe('multiplierFor', () => {
	it('takes two correct answers in a row to move', () => {
		expect([0, 1, 2, 3, 4].map(multiplierFor)).toEqual([1, 1, 2, 2, 3])
	})

	it('caps rather than growing without bound', () => {
		expect(multiplierFor(1000)).toBe(MAX_MULTIPLIER)
	})
})

describe('pointsFor', () => {
	it('pays a base plus a bonus for the clock left', () => {
		// 2s spent leaves 8s: 100 base + 80 bonus, at ×1.
		expect(pointsFor(2000, 0)).toBe(180)
	})

	it('pays the base alone when the clock is gone', () => {
		expect(pointsFor(QUESTION_MS, 0)).toBe(100)
	})

	it('multiplies by the streak standing before the answer', () => {
		expect(pointsFor(2000, 2)).toBe(360)
	})

	it('cannot be inflated by claiming negative time', () => {
		expect(pointsFor(-999_999, 0)).toBeLessThanOrEqual(pointsFor(0, 0))
	})
})

describe('tally', () => {
	it('replays a run into the numbers a session row stores', () => {
		const result = tally([
			{ correct: true, answerMs: 2000 }, // ×1 -> 180
			{ correct: true, answerMs: 2000 }, // ×1 -> 180
			{ correct: true, answerMs: 2000 }, // ×2 -> 360
			{ correct: false, answerMs: 3000 },
		])

		expect(result).toMatchObject({
			questionCount: 4,
			correctCount: 3,
			wrongCount: 1,
			maxStreak: 3,
			score: 720,
		})
		expect(result.points).toEqual([180, 180, 360, 0])
	})

	it('breaks the streak on a wrong answer but keeps the best one', () => {
		const result = tally([
			{ correct: true, answerMs: 0 },
			{ correct: true, answerMs: 0 },
			{ correct: false, answerMs: 0 },
			{ correct: true, answerMs: 0 },
		])

		expect(result.maxStreak).toBe(2)
		// The answer after the break is back to ×1, not still at ×2.
		expect(result.points[3]).toBe(result.points[0])
	})

	it('treats an empty run as a zero, not as an error', () => {
		expect(tally([])).toMatchObject({ questionCount: 0, score: 0, maxStreak: 0 })
	})
})
