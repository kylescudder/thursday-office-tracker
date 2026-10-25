import { SQL } from 'bun'

export function createHealthCheck(databaseUrl: string) {
  let probe: Promise<void> | undefined
  return () => {
    probe ??= check().finally(() => {
      probe = undefined
    })
    return probe
  }

  async function check() {
    // Own this connection so a deadline can retire it without touching app SQL.
    const sql = new SQL(databaseUrl, { max: 1, connectionTimeout: 3 })
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        sql.begin(async (probe) => {
          await probe`SET LOCAL statement_timeout = '3s'`
          await probe`SELECT id FROM votes LIMIT 0`
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), 3000)
        })
      ])
    } finally {
      clearTimeout(timer)
      // A SQL statement timeout cannot stop a socket that never reaches Postgres.
      // Bun waits forever with timeout 0; a positive timeout force-closes it.
      await sql.close({ timeout: 1 })
    }
  }
}
