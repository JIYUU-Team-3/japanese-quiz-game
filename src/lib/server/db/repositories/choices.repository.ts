import { eq } from 'drizzle-orm'
import { BaseRepository } from '../repository'
import { choices } from '../schema'

export class ChoicesRepository extends BaseRepository {
	find_by_id(id: number) {
		return this.db.query.choices.findFirst({ where: eq(choices.id, id) })
	}

	list_by_question(question_id: number) {
		return this.db.select().from(choices).where(eq(choices.questionId, question_id))
	}

	create(input: typeof choices.$inferInsert) {
		return this.db.insert(choices).values(input).returning()
	}

	update(id: number, input: Partial<typeof choices.$inferInsert>) {
		return this.db.update(choices).set(input).where(eq(choices.id, id)).returning()
	}

	remove(id: number) {
		return this.db.delete(choices).where(eq(choices.id, id))
	}
}
