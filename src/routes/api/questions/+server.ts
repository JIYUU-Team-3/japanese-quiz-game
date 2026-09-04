import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { listQuestions } from '#lib/server/game/queries.js'
import { PLAYABLE_LEVELS, type JlptLevel } from '#lib/game/types.js'

/**
 * A course's bank, with choices.
 *
 * This response carries `isCorrect`, which makes the answer key readable in
 * devtools. That is a deliberate trade: the run screen has to say `せいかい！`
 * the moment a finger lands, and a round trip per question would put the
 * network inside a ten-second clock. The leaderboard is protected instead at
 * `POST /api/sessions`, which regrades every answer server-side and ignores
 * whatever score the client thought it had.
 */
export const GET: RequestHandler = async ({ locals, url, setHeaders }) => {
	const level = url.searchParams.get('level')
	if (!level || !PLAYABLE_LEVELS.includes(level as JlptLevel)) {
		error(400, `level must be one of ${PLAYABLE_LEVELS.join(', ')}`)
	}

	const topicParam = url.searchParams.get('topic')
	let topicId: number | undefined
	if (topicParam !== null) {
		topicId = Number(topicParam)
		if (!Number.isInteger(topicId) || topicId <= 0) error(400, 'topic must be a positive integer')
	}

	// The bank changes only when someone authors a question, and a stale minute
	// costs a player nothing — but it must not be shared between courses.
	setHeaders({ 'cache-control': 'public, max-age=60' })
	return json(await listQuestions(locals.db, level as JlptLevel, topicId))
}
