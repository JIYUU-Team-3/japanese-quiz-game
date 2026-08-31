import { eq } from 'drizzle-orm'
import { BaseRepository } from '../repository'
import { topics } from '../schema'

export class TopicsRepository extends BaseRepository {
	find_by_id(id: number) {
		return this.db.query.topics.findFirst({ where: eq(topics.id, id) })
	}

	find_by_slug(slug: string) {
		return this.db.query.topics.findFirst({ where: eq(topics.slug, slug) })
	}

	list() {
		return this.db.select().from(topics)
	}

	create(input: typeof topics.$inferInsert) {
		return this.db.insert(topics).values(input).returning()
	}

	update(id: number, input: Partial<typeof topics.$inferInsert>) {
		return this.db.update(topics).set(input).where(eq(topics.id, id)).returning()
	}

	remove(id: number) {
		return this.db.delete(topics).where(eq(topics.id, id))
	}
}
