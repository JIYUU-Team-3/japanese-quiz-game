import { describe, expect, it } from 'vitest'
import { parseSubmission, SubmissionError } from './record-session'

/**
 * `parseSubmission` is the only thing standing between an untrusted POST body
 * and the database `recordSession` writes to, so every rule it enforces is
 * covered on its own here rather than only indirectly through the e2e suite.
 */

const validAnswer = { questionId: 1, choiceId: 2, answerMs: 1500 }
const validBody = {
	playerName: 'AAA',
	level: 'N4',
	answers: [validAnswer],
	durationMs: 10_000,
}

describe('parseSubmission', () => {
	it('accepts a minimal valid submission and fills in the defaults', () => {
		const result = parseSubmission(validBody)

		expect(result).toMatchObject({
			playerName: 'AAA',
			level: 'N4',
			mode: 'survival',
			topicId: null,
			status: 'finished',
			durationMs: 10_000,
		})
	})

	it('rejects a non-object body', () => {
		expect(() => parseSubmission(null)).toThrow(SubmissionError)
		expect(() => parseSubmission('nope')).toThrow(SubmissionError)
	})

	it('uppercases the name and drops characters outside the cabinet alphabet', () => {
		const result = parseSubmission({ ...validBody, playerName: 'a!b?c' })
		expect(result.playerName).toBe('ABC')
	})

	it('rejects a name that is empty once normalised', () => {
		expect(() => parseSubmission({ ...validBody, playerName: '???' })).toThrow(SubmissionError)
	})

	it('truncates a name past the cabinet limit rather than rejecting it', () => {
		const result = parseSubmission({ ...validBody, playerName: 'ABCDEFGH' })
		expect(result.playerName).toBe('ABCDEF')
	})

	it('rejects a level outside the playable set', () => {
		// N5/N2/N1 exist in the JLPT type but are not offered as a course yet.
		expect(() => parseSubmission({ ...validBody, level: 'N5' })).toThrow(SubmissionError)
		expect(() => parseSubmission({ ...validBody, level: 'not-a-level' })).toThrow(SubmissionError)
	})

	it('rejects a mode outside the known set', () => {
		expect(() => parseSubmission({ ...validBody, mode: 'endless' })).toThrow(SubmissionError)
	})

	it('rejects a status other than finished or abandoned', () => {
		expect(() => parseSubmission({ ...validBody, status: 'winning' })).toThrow(SubmissionError)
	})

	it('rejects a negative or non-finite durationMs', () => {
		expect(() => parseSubmission({ ...validBody, durationMs: -1 })).toThrow(SubmissionError)
		expect(() => parseSubmission({ ...validBody, durationMs: Number.NaN })).toThrow(SubmissionError)
	})

	it('rejects a run with no answers', () => {
		expect(() => parseSubmission({ ...validBody, answers: [] })).toThrow(SubmissionError)
	})

	it('rejects a run past the answer ceiling', () => {
		const answers = Array.from({ length: 301 }, () => validAnswer)
		expect(() => parseSubmission({ ...validBody, answers })).toThrow(SubmissionError)
	})

	it('rejects an answer with a non-positive questionId', () => {
		const answers = [{ ...validAnswer, questionId: 0 }]
		expect(() => parseSubmission({ ...validBody, answers })).toThrow(SubmissionError)
	})

	it('accepts a null choiceId as a recorded timeout', () => {
		const answers = [{ ...validAnswer, choiceId: null }]
		const result = parseSubmission({ ...validBody, answers })
		expect(result.answers[0].choiceId).toBeNull()
	})
})
