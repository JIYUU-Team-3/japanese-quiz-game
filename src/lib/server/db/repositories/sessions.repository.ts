import { eq } from 'drizzle-orm'
import { BaseRepository } from '../repository'
import { sessions } from '../schema'

export class SessionsRepository extends BaseRepository {
	find_by_id(id: string) {
		return this.db.query.sessions.findFirst({ where: eq(sessions.id, id) })
	}

	list_by_player(player_id: number) {
		return this.db.select().from(sessions).where(eq(sessions.playerId, player_id))
	}

	create(input: typeof sessions.$inferInsert) {
		return this.db.insert(sessions).values(input).returning()
	}

	update(id: string, input: Partial<typeof sessions.$inferInsert>) {
		return this.db.update(sessions).set(input).where(eq(sessions.id, id)).returning()
	}

	remove(id: string) {
		return this.db.delete(sessions).where(eq(sessions.id, id))
	}
}
