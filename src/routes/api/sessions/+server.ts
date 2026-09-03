import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { recordSession, SubmissionError } from '#lib/server/game/record-session.js'

/** Records a finished run. The posted answers are regraded here; see the recorder. */
export const POST: RequestHandler = async ({ locals, request }) => {
	let body: unknown
	try {
		body = await request.json()
	} catch {
		error(400, 'Expected a JSON body.')
	}

	try {
		return json(await recordSession(locals, body), { status: 201 })
	} catch (cause) {
		if (cause instanceof SubmissionError) error(cause.status, cause.message)
		throw cause
	}
}
