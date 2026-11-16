import postgres from 'postgres'

// Fixed past weeks (London midnight, which is UTC in late 2026), so history
// screens look the same on every run. Names are fictional.
const PREVIOUS_WEEKS = [
  {
    weekStart: Date.parse('2026-10-26T00:00:00Z'),
    votes: [
      ['Sam Okafor', 'yes'],
      ['Priya Shah', 'no'],
      ['Jordan Kim', 'could-be-convinced'],
      ['Alex Reid', 'yes']
    ]
  },
  {
    weekStart: Date.parse('2026-11-02T00:00:00Z'),
    votes: [
      ['Sam Okafor', 'no'],
      ['Priya Shah', 'yes'],
      ['Taylor Brooks', 'yes']
    ]
  }
] as const

const SEEDED_WEEK_STARTS = PREVIOUS_WEEKS.map((week) => week.weekStart)

export async function seedVotes(databaseUrl: string) {
  const sql = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 2,
    onnotice: () => {}
  })
  try {
    for (const week of PREVIOUS_WEEKS) {
      for (const [index, [name, option]] of week.votes.entries()) {
        await sql`
          INSERT INTO votes (name, option, week_start, "timestamp")
          VALUES (${name}, ${option}, ${week.weekStart}, ${week.weekStart + (index + 1) * 3_600_000})
          ON CONFLICT DO NOTHING
        `
      }
    }
  } finally {
    await sql.end({ timeout: 1 })
  }
}

// Removes every vote outside the seeded history, so each test starts with an
// empty current week. The browser projects share one database.
export async function resetCurrentWeekVotes(databaseUrl: string) {
  const sql = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 2,
    onnotice: () => {}
  })
  try {
    await sql`DELETE FROM votes WHERE week_start NOT IN ${sql(SEEDED_WEEK_STARTS)}`
  } finally {
    await sql.end({ timeout: 1 })
  }
}
