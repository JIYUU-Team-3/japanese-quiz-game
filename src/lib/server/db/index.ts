import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export const get_db = (d1: D1Database) => drizzle(d1, { schema })
