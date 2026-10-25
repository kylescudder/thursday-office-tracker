import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  pgTable,
  serial,
  text,
  unique
} from 'drizzle-orm/pg-core'

export const votes = pgTable(
  'votes',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    option: text('option', {
      enum: ['yes', 'no', 'could-be-convinced']
    }).notNull(),
    // Millisecond epochs; well within Number's safe range.
    weekStart: bigint('week_start', { mode: 'number' }).notNull(),
    timestamp: bigint('timestamp', { mode: 'number' }).notNull()
  },
  (table) => [
    check(
      'votes_option_check',
      sql`${table.option} IN ('yes', 'no', 'could-be-convinced')`
    ),
    unique('votes_week_start_name_key').on(table.weekStart, table.name)
  ]
)
