import { eq } from 'drizzle-orm'
import { BaseRepository } from '../repository'
import { questions } from '../schema'

export class QuestionsRepository extends BaseRepository {
	find_by_id(id: number) {
		return this.db.query.questions.findFirst({ where: eq(questions.id, id) })
	}

	list_by_topic(topic_id: number) {
		return this.db.select().from(questions).where(eq(questions.topic_id, topic_id))
	}

	create(input: typeof questions.$inferInsert) {
		return this.db.insert(questions).values(input).returning()
	}

	update(id: number, input: Partial<typeof questions.$inferInsert>) {
		return this.db.update(questions).set(input).where(eq(questions.id, id)).returning()
	}

	remove(id: number) {
		return this.db.delete(questions).where(eq(questions.id, id))
	}
}
