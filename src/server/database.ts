import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { url } from './database-url'
import * as schema from './schema'

export { url }

export const sql = postgres(url.toString(), {
  max: 4,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {}
})

export const db = drizzle(sql, { schema })
