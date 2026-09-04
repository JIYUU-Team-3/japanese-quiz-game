import {
	NAME_CHARS,
	NAME_MAX,
	SESSION_MODE,
	TABLE_SIZE,
	type DemoQuestion,
	type JlptLevel,
	type LeaderboardRow,
	type Question,
	type QuestionCounts,
	type SessionMode,
	type SessionSubmission,
	type SubmitResponse,
	type Topic,
} from './types'

/* ═══════════════════════════════════════════════════════════════════════════
 * THE BACKEND SEAM
 *
 * Every component talks to the game through this module and nothing else. No
 * component builds a URL, and none knows the shape of a response before this
 * file has checked it.
 *
 * Behind these four calls is D1, reached through `src/lib/server/game/`:
 *
 *   fetchTopics()       GET  /api/topics
 *   fetchQuestions()    GET  /api/questions?level=&topic=
 *   fetchLeaderboard()  GET  /api/leaderboard?level=&mode=
 *   submitSession()     POST /api/sessions
 *
 * Pages that can afford to wait for the server do NOT come through here: they
 * call `src/lib/server/game/queries.ts` from a `+page.server.ts` load and get
 * their first paint rendered. This module is for what a page can only learn
 * after the player acts — which course they picked, which filter they pressed,
 * what their run scored.
 *
 * The one thing this module deliberately does not do is decide a score.
 * `submitSession` posts the run's answers, never its total, and reads back what
 * the server recorded. A client that could name its own score could name any.
 * ═══════════════════════════════════════════════════════════════════════════ */

export { NAME_CHARS, NAME_MAX, TABLE_SIZE }

/** SvelteKit hands load functions their own `fetch`; the browser has the global. */
type Fetch = typeof globalThis.fetch

/**
 * A failure the UI is expected to show rather than swallow.
 *
 * The cabinet has no offline mode: if the bank cannot be read there is no run
 * to start, and saying so is the only honest screen.
 */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message)
		this.name = 'ApiError'
	}
}

async function get<T>(path: string, fetcher: Fetch = fetch): Promise<T> {
	let response: Response
	try {
		response = await fetcher(path)
	} catch {
		throw new ApiError(0, 'NETWORK UNAVAILABLE')
	}
	if (!response.ok) throw new ApiError(response.status, await readError(response))
	return (await response.json()) as T
}

async function readError(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as { message?: unknown }
		if (typeof body.message === 'string' && body.message.length > 0) return body.message
	} catch {
		// A non-JSON error body is still an error; the status carries the meaning.
	}
	return `SERVER ERROR ${response.status}`
}

export function fetchTopics(fetcher?: Fetch): Promise<Topic[]> {
	return get<Topic[]>('/api/topics', fetcher)
}

/**
 * Questions for one course, ready to play.
 *
 * Unanswerable rows — an unsupported format, or a question with no correct
 * choice — are filtered out server-side, so a non-empty result here is always
 * a playable bank.
 */
export function fetchQuestions(
	level: JlptLevel,
	topicId?: number,
	fetcher?: Fetch,
): Promise<Question[]> {
	const params = new URLSearchParams({ level })
	if (topicId !== undefined) params.set('topic', String(topicId))
	return get<Question[]>(`/api/questions?${params}`, fetcher)
}

export function fetchLeaderboard(
	level: JlptLevel | null,
	mode: SessionMode = SESSION_MODE,
	fetcher?: Fetch,
): Promise<LeaderboardRow[]> {
	const params = new URLSearchParams({ mode })
	if (level !== null) params.set('level', level)
	return get<LeaderboardRow[]>(`/api/leaderboard?${params}`, fetcher)
}

/**
 * Posts a finished run and returns what the server actually recorded.
 *
 * The returned score may differ from the one the run screen displayed — that is
 * the point of regrading, and the UI shows the recorded figure once it arrives.
 */
export async function submitSession(
	submission: SessionSubmission,
	fetcher: Fetch = fetch,
): Promise<SubmitResponse> {
	let response: Response
	try {
		response = await fetcher('/api/sessions', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(submission),
		})
	} catch {
		throw new ApiError(0, 'NETWORK UNAVAILABLE')
	}
	if (!response.ok) throw new ApiError(response.status, await readError(response))
	return (await response.json()) as SubmitResponse
}

/* ── board arithmetic (no I/O) ────────────────────────────────────────────── */

/**
 * Where a score would land, 1-indexed, or null if it misses the table.
 *
 * This is a prediction, made so GAME OVER can raise the name-entry pad without
 * waiting on the network. The rank that is finally shown comes back from the
 * server with the recorded run.
 */
export function placementFor(score: number, table: readonly LeaderboardRow[]): number | null {
	// A run that scored nothing has not earned the board, however empty it is.
	if (score <= 0) return null
	const position = table.filter((r) => r.score > score).length + 1
	return position <= TABLE_SIZE ? position : null
}

export type { DemoQuestion, QuestionCounts }
