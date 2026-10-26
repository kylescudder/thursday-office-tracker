# Thursday Office Vibes

Track Thursday office attendance: vote on your weekly office plans and see who's
coming in.

## Running locally

The app is a TanStack Start app with a tRPC API, served by Bun (`server/index.ts`) and backed by Postgres. Run migrations with the schema owner's credentials; the server can then use a restricted runtime role.

```sh
cp .env.example .env   # set DATABASE_URL
bun install
bun run db:migrate     # apply Drizzle migrations from drizzle/
bun run dev            # app and API on :8080
```

In production, `bun run build && bun run start` serves `/healthz`, the built assets and the app from one process.
See [host deployment guide](deploy/README.md) for the container, database and release commands.

## Stack

TanStack Start and Router, React, TypeScript, shadcn/ui and Tailwind CSS, with a
[tRPC](https://trpc.io) API on Bun and PostgreSQL through [Drizzle](https://orm.drizzle.team).
The schema is in `src/server/schema.ts`; run `bun run db:generate` after changing it.

## How can I deploy this project?

Push changes through a pull request. After CI passes, merging to `main` starts
the Release workflow, which publishes an attested container image and deploys
it to the host. The workflow verifies the live `/healthz` reports the exact commit.

Production runs at [office.kylescudder.co.uk](https://office.kylescudder.co.uk).
The frontend and API use one Bun process with a private Postgres database.
GitHub holds deployment credentials only; database credentials stay on the host.

See [the deployment guide](deploy/README.md) for configuration, migration,
release verification and rollback. The former Netlify project has been removed.

## Runtime configuration

Server settings are validated with `@t3-oss/env-core` and Zod when they are read.
Production builds need no runtime credentials. Invalid settings report their names
without logging secret values; see `.env.example` for the deployment settings.
Migration commands validate database settings independently of Clerk configuration.
`DATABASE_PASSWORD_FILE` remains supported for Docker secrets.
