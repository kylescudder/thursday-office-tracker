import { expect, test } from "bun:test";
import { SQL } from "bun";

test("restricted runtime can vote, read history and preserve data across restart", async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (
    !databaseUrl ||
    new URL(databaseUrl).pathname !== "/office_tracker_test"
  ) {
    throw new Error(
      "TEST_DATABASE_URL must name the isolated office_tracker_test database",
    );
  }
  const owner = new SQL(databaseUrl, { max: 2 });
  const runtimeUrl = new URL(databaseUrl);
  runtimeUrl.username = "office_tracker_test_runtime";
  const name = `ci-${crypto.randomUUID()}`;
  const revision = "c".repeat(40);
  const environment: Record<string, string | undefined> = {
    ...process.env,
    DATABASE_URL: databaseUrl,
  };
  delete environment.DATABASE_PASSWORD_FILE;
  let server: ReturnType<typeof Bun.spawn> | undefined;
  const base = "http://127.0.0.1:3100";

  const start = async () => {
    server = Bun.spawn([process.execPath, "server/index.ts"], {
      env: {
        ...environment,
        DATABASE_URL: runtimeUrl.toString(),
        PORT: "3100",
        OFFICE_TRACKER_REVISION: revision,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const response = await fetch(`${base}/api/votes/current`);
        if (response.ok) return;
      } catch {
        // The process has not bound its private listener yet.
      }
      await Bun.sleep(100);
    }
    throw new Error("API did not become ready");
  };
  const stop = async () => {
    server?.kill();
    await server?.exited;
    server = undefined;
  };
  const request = async <T = unknown>(
    path: string,
    method = "GET",
    body?: unknown,
    status = 200,
  ) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    expect(response.status).toBe(status);
    return status === 204 ? (undefined as T) : (response.json() as Promise<T>);
  };

  try {
    await owner.unsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'office_tracker_test_runtime') THEN
        CREATE ROLE office_tracker_test_runtime LOGIN;
      END IF;
    END $$`);
    const migrate = Bun.spawn([process.execPath, "server/migrate.ts"], {
      env: environment,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(await migrate.exited).toBe(0);
    await owner.unsafe(`
      GRANT CONNECT ON DATABASE office_tracker_test TO office_tracker_test_runtime;
      GRANT USAGE ON SCHEMA public TO office_tracker_test_runtime;
      GRANT SELECT, INSERT, UPDATE, DELETE ON votes TO office_tracker_test_runtime;
      GRANT USAGE, SELECT ON SEQUENCE votes_id_seq TO office_tracker_test_runtime;
    `);
    const runtime = new SQL(runtimeUrl.toString(), { max: 1 });
    try {
      const [permissions] = await runtime`
        SELECT current_user AS role,
        has_schema_privilege(current_user, 'public', 'CREATE') AS can_create
      `;
      expect(permissions.role).toBe("office_tracker_test_runtime");
      expect(permissions.can_create).toBe(false);
    } finally {
      await runtime.close();
    }

    await start();
    const acceptance = Bun.spawn([process.execPath, "deploy/verify.ts"], {
      env: {
        ...environment,
        DATABASE_URL: runtimeUrl.toString(),
        OFFICE_TRACKER_REVISION: revision,
        VERIFY_ORIGIN: base,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(await acceptance.exited).toBe(0);
    const [fixtures] =
      await owner`SELECT count(*)::int AS count FROM votes WHERE name LIKE 'deployment-check-%'`;
    expect(fixtures.count).toBe(0);
    const response = await fetch(`${base}/api/votes/current`);
    expect(response.headers.get("X-Office-Tracker-Revision")).toBe(revision);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const html = await (await fetch(base)).text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)];
    expect(assets.length).toBeGreaterThanOrEqual(2);
    for (const [, asset] of assets) {
      const result = await fetch(`${base}${asset}`);
      expect(result.status).toBe(200);
      expect(result.headers.get("Content-Type")).toContain(
        asset.endsWith(".css") ? "text/css" : "javascript",
      );
    }
    const created = await request<{ id: number }>("/api/votes", "POST", {
      name,
      option: "yes",
    });
    expect(typeof created.id).toBe("number");
    const updated = await request<{ id: number }>("/api/votes", "POST", {
      name,
      option: "could-be-convinced",
    });
    expect(updated.id).toBe(created.id);
    const votes =
      await request<{ name: string; option: string }[]>("/api/votes/current");
    expect(
      votes.filter((vote: { name: string }) => vote.name === name),
    ).toHaveLength(1);
    expect(
      votes.find((vote: { name: string }) => vote.name === name)?.option,
    ).toBe("could-be-convinced");
    const history =
      await request<{ votes: { name: string }[] }[]>("/api/votes/history");
    expect(
      history.some((week: { votes: { name: string }[] }) =>
        week.votes.some((vote) => vote.name === name),
      ),
    ).toBe(true);
    await request("/api/votes", "POST", { name, option: "invalid" }, 400);
    await request("/api/votes", "POST", { name: " ", option: "yes" }, 400);
    expect((await fetch(`${base}/api/not-found`)).status).toBe(404);
    await stop();
    await start();
    const persisted =
      await request<{ name: string; option: string }[]>("/api/votes/current");
    expect(persisted.some((vote: { name: string }) => vote.name === name)).toBe(
      true,
    );
    await request("/api/votes", "DELETE", { name }, 204);
    const final =
      await request<{ votes: { name: string }[] }[]>("/api/votes/history");
    expect(
      final.some((week: { votes: { name: string }[] }) =>
        week.votes.some((vote) => vote.name === name),
      ),
    ).toBe(false);
  } finally {
    await stop();
    await owner`DELETE FROM votes WHERE name = ${name}`;
    await owner.close();
  }
}, 30000);
