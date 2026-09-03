import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { listLeaderboard } from '#lib/server/game/queries.js'
import {
	PLAYABLE_LEVELS,
	SESSION_MODE,
	sessionModes,
	type JlptLevel,
	type SessionMode,
} from '#lib/game/types.js'

export const GET: RequestHandler = async ({ locals, url, setHeaders }) => {
	const levelParam = url.searchParams.get('level')
	if (levelParam !== null && !PLAYABLE_LEVELS.includes(levelParam as JlptLevel)) {
		error(400, `level must be one of ${PLAYABLE_LEVELS.join(', ')}`)
	}

	const modeParam = url.searchParams.get('mode') ?? SESSION_MODE
	if (!(sessionModes as readonly string[]).includes(modeParam)) {
		error(400, `mode must be one of ${sessionModes.join(', ')}`)
	}

	// The board must never be cached: a player who just entered a name comes
	// straight here to see it, and a stale table reads as a lost score.
	setHeaders({ 'cache-control': 'no-store' })
	return json(
		await listLeaderboard(locals.db, (levelParam as JlptLevel) ?? null, modeParam as SessionMode),
	)
}
