import type { PageServerLoad } from './$types'
import { countQuestions, listLeaderboard } from '#lib/server/game/queries.js'

/**
 * What the SELECT COURSE screen needs before a course is chosen: how big each
 * bank is, and the score to beat. The questions themselves are not loaded here
 * — they are fetched when a course is picked, because loading both banks to
 * play one of them would spend a player's first seconds on the wrong one.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const [counts, table] = await Promise.all([
		countQuestions(locals.db),
		listLeaderboard(locals.db, null),
	])

	return { counts, table }
}
