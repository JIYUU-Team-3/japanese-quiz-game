import type { get_db } from '#lib/server/db/index.js'
import type { get_repositories } from '#lib/server/db/repositories/index.js'

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env
			ctx: ExecutionContext
			caches: CacheStorage
			cf?: IncomingRequestCfProperties
		}

		interface Locals {
			db: ReturnType<typeof get_db>
			repos: ReturnType<typeof get_repositories>
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {}
