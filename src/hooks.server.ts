import { sequence } from '@sveltejs/kit/hooks'
import type { Handle } from '@sveltejs/kit'
import { getTextDirection } from '#lib/paraglide/runtime.js'
import { paraglideMiddleware } from '#lib/paraglide/server.js'
import { get_db } from '$lib/server/db'
import { get_repositories } from '$lib/server/db/repositories'

const handle_db: Handle = ({ event, resolve }) => {
	event.locals.db = get_db(event.platform!.env.quizdb)
	event.locals.repos = get_repositories(event.locals.db)
	return resolve(event)
}

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		// SvelteKit 3 made RequestEvent.request read-only, but Paraglide's scaffold
		// hands back a rewritten request that downstream handlers need to see. The
		// cast keeps the original runtime behaviour; revisit if Paraglide ships a
		// SvelteKit 3 compatible middleware.
		;(event as { request: Request }).request = request

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale)),
		})
	})

export const handle: Handle = sequence(handle_db, handleParaglide)
