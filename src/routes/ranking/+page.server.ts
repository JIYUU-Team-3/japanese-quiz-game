import type { PageServerLoad } from './$types'
import { listLeaderboard } from '#lib/server/game/queries.js'

/**
 * The unfiltered board, rendered server-side.
 *
 * A player arriving here has almost always just typed a name onto it, so the
 * table has to be present in the first response. Pressing a level filter is a
 * later, cheaper read that the page makes itself.
 */
export const load: PageServerLoad = async ({ locals }) => {
	return { table: await listLeaderboard(locals.db, null) }
}
