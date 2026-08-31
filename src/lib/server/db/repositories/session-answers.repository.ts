import { and, eq } from 'drizzle-orm'
import { BaseRepository } from '../repository'
import { session_answers } from '../schema'

export class SessionAnswersRepository extends BaseRepository {
	find_by_key(session_id: string, position: number) {
		return this.db.query.session_answers.findFirst({
			where: and(
				eq(session_answers.session_id, session_id),
				eq(session_answers.position, position),
			),
		})
	}

	list_by_session(session_id: string) {
		return this.db.select().from(session_answers).where(eq(session_answers.session_id, session_id))
	}

	create(input: typeof session_answers.$inferInsert) {
		return this.db.insert(session_answers).values(input).returning()
	}

	remove(session_id: string, position: number) {
		return this.db
			.delete(session_answers)
			.where(
				and(eq(session_answers.session_id, session_id), eq(session_answers.position, position)),
			)
	}
}
