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
    let pid: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        sql.begin(async (probe) => {
          const [backend] = await probe`
            SELECT pg_backend_pid() AS pid,
              set_config('statement_timeout', '3s', true)`
          pid = backend.pid
          await probe`SELECT id FROM votes LIMIT 0`
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), 3000)
        })
      ])
    } catch (error) {
      if (pid) await cancelBackend(pid)
      throw error
    } finally {
      clearTimeout(timer)
      // A SQL statement timeout cannot stop a socket that never reaches Postgres.
      // Bun waits forever with timeout 0; a positive timeout force-closes it.
      await sql.close({ timeout: 1 })
    }
  }

  async function cancelBackend(pid: number) {
    // Closing the socket doesn't stop a backend waiting on a lock, and Bun's
    // query.cancel() only rejects locally, so cancel it from another connection.
    const sql = new SQL(databaseUrl, { max: 1, connectionTimeout: 1 })
    await Promise.race([
      sql`SELECT pg_cancel_backend(${pid})`,
      Bun.sleep(500)
    ]).catch(() => {})
    void sql.close({ timeout: 1 }).catch(() => {})
  }
}
