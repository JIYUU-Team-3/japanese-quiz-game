import { eq } from 'drizzle-orm'
import { BaseRepository } from '../repository'
import { players } from '../schema'

export class PlayersRepository extends BaseRepository {
	find_by_id(id: number) {
		return this.db.query.players.findFirst({ where: eq(players.id, id) })
	}

	list() {
		return this.db.select().from(players)
	}

	create(input: typeof players.$inferInsert) {
		return this.db.insert(players).values(input).returning()
	}

	update(id: number, input: Partial<typeof players.$inferInsert>) {
		return this.db.update(players).set(input).where(eq(players.id, id)).returning()
	}

	remove(id: number) {
		return this.db.delete(players).where(eq(players.id, id))
	}
}
