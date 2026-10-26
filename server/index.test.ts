import { expect, test } from 'bun:test'
import postgres from 'postgres'
import { stallHealthQueries } from './postgres-proxy'

test('restricted runtime can vote, read history and preserve data across restart', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL
  if (
    !databaseUrl ||
    new URL(databaseUrl).pathname !== '/office_tracker_test'
  ) {
    throw new Error(
      'TEST_DATABASE_URL must name the isolated office_tracker_test database'
    )
  }
  const owner = postgres(databaseUrl, { max: 2, onnotice: () => {} })
  const runtimeUrl = new URL(databaseUrl)
  runtimeUrl.username = 'office_tracker_test_runtime'
  const name = `ci-${crypto.randomUUID()}`
  const revision = 'c'.repeat(40)
  const environment: Record<string, string | undefined> = {
    ...process.env,
    DATABASE_URL: databaseUrl
  }
  delete environment.DATABASE_PASSWORD_FILE
  let server: ReturnType<typeof Bun.spawn> | undefined
  const base = 'http://127.0.0.1:3100'

  const start = async (database = runtimeUrl.toString()) => {
    server = Bun.spawn([process.execPath, 'server/index.ts'], {
      env: {
        ...environment,
        DATABASE_URL: database,
        PORT: '3100',
        OFFICE_TRACKER_REVISION: revision
      },
      stdout: 'pipe',
      stderr: 'pipe'
    })
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const response = await fetch(`${base}/api/trpc/votes.current`)
        if (response.ok) return
      } catch {
        // The process has not bound its private listener yet.
      }
      await Bun.sleep(100)
    }
    const failed = server
    await stop()
    throw new Error(
      'API did not become ready: ' +
        (await new Response(
          failed?.stderr as ReadableStream | undefined
        ).text())
    )
  }
  const stop = async () => {
    server?.kill()
    await server?.exited
    server = undefined
  }
  const request = async <T = unknown>(
    path: string,
    method = 'GET',
    body?: unknown,
    status = 200
  ) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    expect(response.status).toBe(status)
    // tRPC wraps results as { result: { data } }.
    const payload = (await response.json()) as { result?: { data?: T } }
    return payload.result?.data as T
  }

  try {
    await owner.unsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'office_tracker_test_runtime') THEN
        CREATE ROLE office_tracker_test_runtime LOGIN;
      END IF;
    END $$`)
    await owner`ALTER ROLE office_tracker_test_runtime CONNECTION LIMIT 8`
    // Migrations are repeatable: the second run must be a no-op.
    for (let run = 0; run < 2; run++) {
      const migrate = Bun.spawn([process.execPath, 'server/migrate.ts'], {
        env: environment,
        stdout: 'pipe',
        stderr: 'pipe'
      })
      expect(await migrate.exited).toBe(0)
    }
    const [journal] =
      await owner`SELECT count(*)::int AS applied FROM drizzle.__drizzle_migrations`
    expect(journal.applied).toBe(1)
    await owner.unsafe(`
      GRANT CONNECT ON DATABASE office_tracker_test TO office_tracker_test_runtime;
      GRANT USAGE ON SCHEMA public TO office_tracker_test_runtime;
      GRANT SELECT, INSERT, UPDATE, DELETE ON votes TO office_tracker_test_runtime;
      GRANT USAGE, SELECT ON SEQUENCE votes_id_seq TO office_tracker_test_runtime;
    `)
    const runtime = postgres(runtimeUrl.toString(), {
      max: 1,
      onnotice: () => {}
    })
    try {
      const [permissions] = await runtime`
        SELECT current_user AS role,
        has_schema_privilege(current_user, 'public', 'CREATE') AS can_create
      `
      expect(permissions.role).toBe('office_tracker_test_runtime')
      expect(permissions.can_create).toBe(false)
      // The migration journal is out of the runtime role's reach.
      await expect(
        runtime`SELECT hash FROM drizzle.__drizzle_migrations`
      ).rejects.toMatchObject({ code: '42501' })
    } finally {
      await runtime.end({ timeout: 1 })
    }

    await start()
    // Keep all four app connections open, as they can be under real traffic.
    let warmup: Promise<Response>[] = []
    await owner.begin(async (lock) => {
      await lock`LOCK TABLE votes IN ACCESS EXCLUSIVE MODE`
      warmup = Array.from({ length: 4 }, () =>
        fetch(`${base}/api/trpc/votes.current`)
      )
      const deadline = Date.now() + 3000
      for (;;) {
        const [activity] = await owner`SELECT count(*)::int AS active
          FROM pg_stat_activity WHERE datname = current_database()
          AND usename = 'office_tracker_test_runtime' AND state = 'active'
          AND query ILIKE '%from "votes" where "votes"."week_start"%'`
        if (activity.active === 4) break
        if (Date.now() > deadline) throw new Error('App pool did not fill')
        await Bun.sleep(25)
      }
    })
    for (const response of await Promise.all(warmup))
      expect(response.status).toBe(200)
    const acceptance = Bun.spawn([process.execPath, 'deploy/verify.ts'], {
      env: {
        ...environment,
        DATABASE_URL: runtimeUrl.toString(),
        OFFICE_TRACKER_REVISION: revision,
        VERIFY_ORIGIN: base
      },
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const acceptanceExit = await acceptance.exited
    const acceptanceError = await new Response(acceptance.stderr).text()
    expect(acceptanceError).toBe('')
    expect(acceptanceExit).toBe(0)
    const [fixtures] =
      await owner`SELECT count(*)::int AS count FROM votes WHERE name LIKE 'deployment-check-%'`
    expect(fixtures.count).toBe(0)
    const response = await fetch(`${base}/api/trpc/votes.current`)
    expect(response.headers.get('X-Office-Tracker-Revision')).toBe(revision)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await owner.begin(async (lock) => {
      await lock`LOCK TABLE votes IN ACCESS EXCLUSIVE MODE`
      const probes = await Promise.all(
        Array.from({ length: 8 }, () =>
          fetch(`${base}/healthz`, { signal: AbortSignal.timeout(4500) })
        )
      )
      for (const probe of probes) {
        expect(probe.status).toBe(503)
        expect(await probe.json()).toEqual({ ok: false })
        expect(probe.headers.get('Cache-Control')).toBe('no-store')
        expect(probe.headers.get('X-Office-Tracker-Revision')).toBe(revision)
      }
      const deadline = Date.now() + 1500
      for (;;) {
        const [activity] =
          await owner`SELECT count(*)::int AS active FROM pg_stat_activity
          WHERE datname = current_database() AND usename = 'office_tracker_test_runtime'
          AND state = 'active' AND query ILIKE '%SELECT id FROM votes LIMIT 0%'`
        if (activity.active === 0) break
        if (Date.now() > deadline)
          throw new Error('Health probe SQL outlived its deadline')
        await Bun.sleep(25)
      }
    })
    expect((await fetch(`${base}/healthz`)).status).toBe(200)
    await stop()
    const proxy = await stallHealthQueries(
      runtimeUrl.toString(),
      /^SELECT id FROM votes LIMIT 0$/i
    )
    try {
      // Let startup's own table check through, then stall new health probes.
      proxy.allowNewConnections()
      await start(proxy.url)
      proxy.stall()
      const probes = await Promise.all(
        Array.from({ length: 8 }, () => fetch(`${base}/healthz`))
      )
      for (const probe of probes) {
        expect(probe.status).toBe(503)
        expect(await probe.json()).toEqual({ ok: false })
      }
      expect((await fetch(`${base}/api/trpc/votes.current`)).status).toBe(200)
      proxy.allowNewConnections()
      expect((await fetch(`${base}/healthz`)).status).toBe(200)
      const deadline = Date.now() + 1000
      while (proxy.stalledConnections && Date.now() < deadline)
        await Bun.sleep(10)
      expect(proxy.stalledConnections).toBe(0)
    } finally {
      await stop()
      await proxy.close()
    }
    await start()

    const html = await (await fetch(base)).text()
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
    expect(assets.length).toBeGreaterThanOrEqual(2)
    for (const [, asset] of assets) {
      const result = await fetch(`${base}${asset}`)
      expect(result.status).toBe(200)
      expect(result.headers.get('Content-Type')).toContain(
        asset.endsWith('.css') ? 'text/css' : 'javascript'
      )
    }
    const created = await request<{ id: number }>(
      '/api/trpc/votes.add',
      'POST',
      {
        name,
        option: 'yes'
      }
    )
    expect(typeof created.id).toBe('number')
    const updated = await request<{ id: number }>(
      '/api/trpc/votes.add',
      'POST',
      {
        name,
        option: 'could-be-convinced'
      }
    )
    expect(updated.id).toBe(created.id)
    const votes = await request<{ name: string; option: string }[]>(
      '/api/trpc/votes.current'
    )
    expect(
      votes.filter((vote: { name: string }) => vote.name === name)
    ).toHaveLength(1)
    expect(
      votes.find((vote: { name: string }) => vote.name === name)?.option
    ).toBe('could-be-convinced')
    const history = await request<{ votes: { name: string }[] }[]>(
      '/api/trpc/votes.history'
    )
    expect(
      history.some((week: { votes: { name: string }[] }) =>
        week.votes.some((vote) => vote.name === name)
      )
    ).toBe(true)
    await request(
      '/api/trpc/votes.add',
      'POST',
      { name, option: 'invalid' },
      400
    )
    await request(
      '/api/trpc/votes.add',
      'POST',
      { name: ' ', option: 'yes' },
      400
    )
    expect((await fetch(`${base}/api/trpc/votes.missing`)).status).toBe(404)
    await stop()
    await start()
    const persisted = await request<{ name: string; option: string }[]>(
      '/api/trpc/votes.current'
    )
    expect(persisted.some((vote: { name: string }) => vote.name === name)).toBe(
      true
    )
    await request('/api/trpc/votes.remove', 'POST', { name })
    const final = await request<{ votes: { name: string }[] }[]>(
      '/api/trpc/votes.history'
    )
    expect(
      final.some((week: { votes: { name: string }[] }) =>
        week.votes.some((vote) => vote.name === name)
      )
    ).toBe(false)
  } finally {
    await stop()
    await owner`DELETE FROM votes WHERE name = ${name}`
    await owner.end({ timeout: 1 })
  }
}, 30000)
