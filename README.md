# Thursday Office Vibes

Track Thursday office attendance: vote on your weekly office plans and see who's
coming in.

## Running locally

The app is a Vite frontend plus a small Bun API server (`server/index.ts`) backed by Postgres. Run migrations with the schema owner's credentials; the server can then use a restricted runtime role.

```sh
cp .env.example .env   # set DATABASE_URL
bun install
bun run db:migrate     # create the votes table
bun run dev:server     # API on :3000
bun run dev            # frontend on :8080, proxies /api to :3000
```

In production, `bun run build && bun run start` serves both the API and the built frontend from one process.
See [host deployment guide](deploy/README.md) for the container, database and release commands.

## Stack

Vite, React, TypeScript, shadcn/ui and Tailwind CSS on the frontend; a Bun API server
with PostgreSQL behind it.

## How can I deploy this project?

Push changes through a pull request. After CI passes, merging to `main` starts
the Release workflow, which publishes an attested container image and deploys
it to the host. The workflow verifies the live API reports the exact commit.

Production runs at [office.kylescudder.co.uk](https://office.kylescudder.co.uk).
The frontend and API use one Bun process with a private Postgres database.
GitHub holds deployment credentials only; database credentials stay on the host.

See [the deployment guide](deploy/README.md) for configuration, migration,
release verification and rollback. The former Netlify project has been removed.
