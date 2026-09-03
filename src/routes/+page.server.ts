import type { PageServerLoad } from './$types'
import { listLeaderboard, sampleQuestions } from '#lib/server/game/queries.js'

/**
 * The attract screen is rendered whole on the server.
 *
 * A cabinet in attract mode is never blank — it is showing a board and cycling
 * a question before anyone walks up to it. Fetching either of those from the
 * browser would put a `LOADING…` frame between arriving and seeing the machine,
 * which is the one frame this screen exists to avoid.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const [table, demo] = await Promise.all([
		listLeaderboard(locals.db, null),
		sampleQuestions(locals.db, 8),
	])

	return { table: table.slice(0, 5), demo }
}
