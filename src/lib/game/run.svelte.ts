import {
	MAX_MULTIPLIER,
	QUESTION_MS,
	START_LIVES,
	clampElapsed,
	multiplierFor,
	pointsFor,
} from './scoring'
import {
	SESSION_MODE,
	type Choice,
	type JlptLevel,
	type LeaderboardRow,
	type Question,
	type RecordedAnswer,
	type RecordedSession,
	type SessionSubmission,
} from './types'

// Re-exported so screens read the machine's constants off the machine and not
// off the rulebook the server also reads.
export { QUESTION_MS, START_LIVES, MAX_MULTIPLIER }

/**
 * Feedback now holds until the player presses NEXT, but not from the very first
 * frame: a double tap or a mashed key would otherwise skip the verdict the
 * pause exists to show.
 */
const NEXT_ARM_MS = 350

export type Phase = 'select' | 'loading' | 'asking' | 'feedback' | 'over'

/** A question with its choices shuffled for this run. */
export interface ServedQuestion {
	source: Question
	choices: Choice[]
	/** Index into the shuffled `choices`. */
	answer: number
}

/**
 * A uniform integer in `[0, bound)`, drawn from the platform CSPRNG.
 *
 * Shuffling quiz answers is not a security decision, but `Math.random` is a
 * weak PRNG that static analysis flags on sight (typescript:S2245) and
 * `crypto.getRandomValues` costs nothing at this size. Draws landing in the
 * short tail past the last whole multiple of `bound` are redrawn rather than
 * folded down with `%`, which would leave the low indices very slightly
 * likelier than the high ones.
 */
function randomBelow(bound: number): number {
	const limit = Math.floor(0x1_0000_0000 / bound) * bound
	const buf = new Uint32Array(1)
	let drawn: number
	do {
		crypto.getRandomValues(buf)
		drawn = buf[0]
	} while (drawn >= limit)
	return drawn % bound
}

function shuffle<T>(input: readonly T[]): T[] {
	const xs = [...input]
	for (let i = xs.length - 1; i > 0; i--) {
		const j = randomBelow(i + 1)
		;[xs[i], xs[j]] = [xs[j], xs[i]]
	}
	return xs
}

function serve(q: Question): ServedQuestion {
	const choices = shuffle(q.choices)
	return { source: q, choices, answer: choices.findIndex((c) => c.isCorrect) }
}

/**
 * The cabinet's run state. One instance per game; `select` is the coin-drop
 * state it returns to. The timer is per question and resets on every serve —
 * time is never carried forward, so every question is worth the same clock.
 */
export class Run {
	phase = $state<Phase>('select')
	level = $state<JlptLevel | null>(null)

	lives = $state(START_LIVES)
	score = $state(0)
	streak = $state(0)
	bestStreak = $state(0)
	solved = $state(0)
	missed = $state(0)
	asked = $state(0)

	index = $state(0)
	queue = $state<ServedQuestion[]>([])
	remaining = $state(QUESTION_MS)

	/**
	 * Every question answered, in play order, as the server will regrade it.
	 * A timeout is recorded too — with a null choice — because a run that went
	 * quiet for ten seconds is a fact about the run, not a gap in it.
	 */
	answers = $state<RecordedAnswer[]>([])

	/** Which choice the player committed to, held through feedback. */
	picked = $state<number | null>(null)
	lastCorrect = $state<boolean | null>(null)
	lastGain = $state(0)
	/** True when the clock ran out rather than the player choosing wrong. */
	timedOut = $state(false)
	/** False for the first moments of feedback, so a stray second input can't skip it. */
	canAdvance = $state(false)

	#startedAt = 0
	#endedAt = 0
	#frame = 0
	#deadline = 0
	#feedback: ReturnType<typeof setTimeout> | undefined

	get current(): ServedQuestion | null {
		return this.queue[this.index] ?? null
	}

	/** The multiplier the next correct answer will bank at. */
	get multiplier(): number {
		return multiplierFor(this.streak)
	}

	get timeFraction(): number {
		return Math.max(0, Math.min(1, this.remaining / QUESTION_MS))
	}

	/** The clock is running out. Drives the panic register in the UI. */
	get critical(): boolean {
		return this.phase === 'asking' && this.remaining <= 3000
	}

	/** Marks the machine as waiting on questions. */
	loading(level: JlptLevel) {
		this.stop()
		this.level = level
		this.phase = 'loading'
	}

	start(level: JlptLevel, questions: readonly Question[]) {
		this.stop()
		this.level = level
		this.queue = shuffle(questions).map(serve)
		this.lives = START_LIVES
		this.score = 0
		this.streak = 0
		this.bestStreak = 0
		this.solved = 0
		this.missed = 0
		this.asked = 0
		this.index = 0
		this.answers = []
		this.picked = null
		this.lastCorrect = null
		this.lastGain = 0
		this.timedOut = false
		this.canAdvance = false
		this.#startedAt = Date.now()
		this.#endedAt = 0
		this.phase = 'asking'
		this.#arm()
	}

	answer(choice: number) {
		if (this.phase !== 'asking' || !this.current) return
		this.#disarm()

		const correct = choice === this.current.answer
		this.picked = choice
		this.lastCorrect = correct
		this.timedOut = false
		this.asked += 1

		// Score off the rounded elapsed time, not off the raw frame clock, so the
		// number banked here is bit-for-bit the number the server recomputes from
		// the `answerMs` this same line records.
		const spent = clampElapsed(QUESTION_MS - this.remaining)
		this.answers.push({
			questionId: this.current.source.id,
			choiceId: this.current.choices[choice].id,
			answerMs: spent,
		})

		if (correct) {
			this.lastGain = pointsFor(spent, this.streak)
			this.score += this.lastGain
			this.streak += 1
			this.bestStreak = Math.max(this.bestStreak, this.streak)
			this.solved += 1
		} else {
			this.lastGain = 0
			this.streak = 0
			this.missed += 1
			this.lives -= 1
		}

		this.#hold()
	}

	/** Leaves feedback for the next question, or GAME OVER if that was the last life. */
	next() {
		if (this.phase !== 'feedback' || !this.canAdvance) return
		this.#advance()
	}

	/** True when NEXT leads to GAME OVER rather than another question. */
	get finalAnswer(): boolean {
		return this.phase === 'feedback' && this.lives <= 0
	}

	/** Back to the coin-drop state. */
	reset() {
		this.stop()
		this.phase = 'select'
		this.level = null
	}

	stop() {
		this.#disarm()
		if (this.#feedback) {
			clearTimeout(this.#feedback)
			this.#feedback = undefined
		}
	}

	/**
	 * The finished run, as it is posted.
	 *
	 * Note what is absent: no score, no counts, no streak. Those are the
	 * server's to compute from `answers`, and the totals this class holds exist
	 * only to be displayed while the run is happening.
	 */
	toSubmission(playerName: string): SessionSubmission {
		return {
			playerName,
			level: this.level ?? 'N4',
			mode: SESSION_MODE,
			topicId: null,
			status: 'finished',
			durationMs: Math.max(0, (this.#endedAt || Date.now()) - this.#startedAt),
			answers: [...this.answers],
		}
	}

	#hold() {
		this.phase = 'feedback'
		this.canAdvance = false
		this.#feedback = setTimeout(() => {
			this.#feedback = undefined
			this.canAdvance = true
		}, NEXT_ARM_MS)
	}

	#advance() {
		if (this.#feedback) {
			clearTimeout(this.#feedback)
			this.#feedback = undefined
		}
		this.canAdvance = false
		this.picked = null
		this.lastCorrect = null
		this.timedOut = false

		if (this.lives <= 0) {
			this.#finish()
			return
		}
		if (this.index + 1 >= this.queue.length) {
			// Bank exhausted before lives ran out: reshuffle and keep the run
			// alive, so a strong player is never stopped by content depth.
			this.queue = shuffle(this.queue.map((s) => serve(s.source)))
			this.index = 0
		} else {
			this.index += 1
		}

		this.phase = 'asking'
		this.#arm()
	}

	#finish() {
		this.#endedAt = Date.now()
		this.phase = 'over'
	}

	#arm() {
		this.remaining = QUESTION_MS
		if (typeof requestAnimationFrame !== 'function') return
		this.#deadline = performance.now() + QUESTION_MS
		const tick = () => {
			this.remaining = Math.max(0, this.#deadline - performance.now())
			if (this.remaining <= 0) {
				this.#frame = 0
				this.#expire()
				return
			}
			this.#frame = requestAnimationFrame(tick)
		}
		this.#frame = requestAnimationFrame(tick)
	}

	#disarm() {
		if (this.#frame) {
			cancelAnimationFrame(this.#frame)
			this.#frame = 0
		}
	}

	#expire() {
		if (this.phase !== 'asking' || !this.current) return
		this.picked = null
		this.lastCorrect = false
		this.timedOut = true
		this.lastGain = 0
		this.answers.push({
			questionId: this.current.source.id,
			choiceId: null,
			answerMs: QUESTION_MS,
		})
		this.streak = 0
		this.missed += 1
		this.lives -= 1
		this.asked += 1
		this.#hold()
	}
}

export interface ActiveRunState {
	run: Run
	recorded: RecordedSession | null
	posted: LeaderboardRow[] | null
	name: string
}

export const activeRunState = $state<ActiveRunState>({
	run: new Run(),
	recorded: null,
	posted: null,
	name: '',
})

export function resetActiveRun() {
	activeRunState.run.reset()
	activeRunState.recorded = null
	activeRunState.posted = null
	activeRunState.name = ''
}
