import type { Handle } from '@sveltejs/kit/hooks'
import { getTextDirection } from '#lib/paraglide/runtime.js'
import { paraglideMiddleware } from '#lib/paraglide/server.js'

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

export const handle: Handle = handleParaglide
