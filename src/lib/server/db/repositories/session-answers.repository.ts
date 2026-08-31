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

	remove(session_id: string, position: number) {
		return this.db
			.delete(sessionAnswers)
			.where(and(eq(sessionAnswers.sessionId, session_id), eq(sessionAnswers.position, position)))
	}
}
