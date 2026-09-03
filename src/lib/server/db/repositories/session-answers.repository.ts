import { and, eq } from 'drizzle-orm'
import { BaseRepository } from '../repository'
import { sessionAnswers } from '../schema'

export class SessionAnswersRepository extends BaseRepository {
	find_by_key(session_id: string, position: number) {
		return this.db.query.sessionAnswers.findFirst({
			where: and(eq(sessionAnswers.sessionId, session_id), eq(sessionAnswers.position, position)),
		})
	}

	list_by_session(session_id: string) {
		return this.db.select().from(sessionAnswers).where(eq(sessionAnswers.sessionId, session_id))
	}

	create(input: typeof sessionAnswers.$inferInsert) {
		return this.db.insert(sessionAnswers).values(input).returning()
	}

	/**
	 * Writes a whole run's answers in one statement.
	 *
	 * A finished run has one row per question asked, and inserting them one at a
	 * time would be that many round trips to D1 while the player waits on GAME
	 * OVER. Callers are responsible for chunking to stay inside D1's per-statement
	 * bound-parameter limit.
	 */
	create_many(input: (typeof sessionAnswers.$inferInsert)[]) {
		if (input.length === 0) return Promise.resolve([])
		return this.db.insert(sessionAnswers).values(input).returning()
	}

	remove(session_id: string, position: number) {
		return this.db
			.delete(sessionAnswers)
			.where(and(eq(sessionAnswers.sessionId, session_id), eq(sessionAnswers.position, position)))
	}
}
