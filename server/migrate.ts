import { sql } from './database'

try {
  await sql`
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      option TEXT NOT NULL CHECK (option IN ('yes', 'no', 'could-be-convinced')),
      week_start BIGINT NOT NULL,
      timestamp BIGINT NOT NULL,
      UNIQUE (week_start, name)
    )
  `
  console.log('Vote schema is ready')
} finally {
  await sql.close()
}
