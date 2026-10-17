import { sql } from "../server/database";

const origin = process.env.VERIFY_ORIGIN || "http://127.0.0.1:3000";
const name = `deployment-check-${crypto.randomUUID()}`;
type Vote = { id: number; name: string; option: string };

async function request(path: string, status = 200, init?: RequestInit) {
  const response = await fetch(origin + path, {
    ...init,
    signal: AbortSignal.timeout(5000),
  });
  if (response.status !== status)
    throw new Error(`${path}: expected ${status}, received ${response.status}`);
  return response;
}

const vote = async (option: string) =>
  (await (
    await request("/api/votes", 200, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, option }),
    })
  ).json()) as { id: number };

try {
  const [permissions] = await sql`
    SELECT current_user AS role,
      has_schema_privilege(current_user, 'public', 'CREATE') AS can_create,
      rolsuper, rolcreatedb, rolcreaterole
    FROM pg_roles WHERE rolname = current_user
  `;
  const expectedRole = new URL(process.env.DATABASE_URL!).username;
  if (
    permissions?.role !== expectedRole ||
    !expectedRole.endsWith("_runtime") ||
    permissions.can_create ||
    permissions.rolsuper ||
    permissions.rolcreatedb ||
    permissions.rolcreaterole
  )
    throw new Error("Runtime database role is not restricted");

  const page = await (await request("/")).text();
  if (!page.includes("Thursday Office Vibes"))
    throw new Error("Frontend page is missing");
  const assets = [...page.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)];
  if (assets.length < 2) throw new Error("Built assets are missing");
  for (const [, asset] of assets) {
    if (!asset.startsWith("/assets/")) throw new Error("Unexpected asset path");
    const response = await request(asset);
    if (
      !response.headers
        .get("Content-Type")
        ?.includes(asset.endsWith(".css") ? "text/css" : "javascript")
    )
      throw new Error("Built asset has an unexpected content type");
  }
  const current = await request("/api/votes/current");
  if (
    current.headers.get("X-Office-Tracker-Revision") !==
      process.env.OFFICE_TRACKER_REVISION ||
    current.headers.get("Cache-Control") !== "no-store"
  )
    throw new Error("API revision/cache headers are incorrect");
  const created = await vote("yes");
  if (!Number.isSafeInteger(created.id)) throw new Error("Vote ID is missing");
  const updated = await vote("could-be-convinced");
  if (updated.id !== created.id)
    throw new Error("Vote update created a duplicate");
  const votes = (await (await request("/api/votes/current")).json()) as Vote[];
  const matches = votes.filter((entry) => entry.name === name);
  if (matches.length !== 1 || matches[0].option !== "could-be-convinced")
    throw new Error("Vote was not stored correctly");
  const history = (await (await request("/api/votes/history")).json()) as {
    votes: Vote[];
  }[];
  if (!history.some((week) => week.votes.some((entry) => entry.name === name)))
    throw new Error("Vote history is missing the submission");
  await request("/api/votes", 400, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, option: "invalid" }),
  });
  await request("/api/votes", 204, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const [remaining] =
    await sql`SELECT count(*)::int AS count FROM votes WHERE name = ${name}`;
  if (remaining.count !== 0) throw new Error("Vote deletion did not persist");
  console.log(
    "Frontend/assets, revision, voting/history/deletion and runtime permissions passed",
  );
} finally {
  try {
    // Remove only this run's unique fixture, including after an API check fails.
    await sql`DELETE FROM votes WHERE name = ${name}`;
  } finally {
    await sql.close();
  }
}
