import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { listTopics } from '#lib/server/game/queries.js'

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=60' })
	return json(await listTopics(locals.db))
}
