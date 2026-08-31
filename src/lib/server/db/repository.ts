import type { get_db } from './index'

export abstract class BaseRepository {
	constructor(protected readonly db: ReturnType<typeof get_db>) {}
}
