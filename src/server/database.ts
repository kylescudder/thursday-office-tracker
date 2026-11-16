import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { url } from './database-url'
import * as schema from './schema'

export { url }

export const sql = postgres(url.toString(), {
  max: 4,
  idle_timeout: 20,
  // postgres.js v4 retries a connection refused for too many connections (53300)
  // until connect_timeout passes, so keep it short: a refusal fails in about 3 s.
  connect_timeout: 2,
  onnotice: () => {}
})

export const db = drizzle(sql, { schema })
