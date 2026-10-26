# Office tracker on the host

## Shared deployment service

This app is registered as `office-tracker` in the central deployment registry
`/Users/kyle/platform/deploy-core/apps.json`. LaunchAgent
`com.kylescudder.deploy-core` runs the single installed engine. Application hooks
are `deploy/hooks.py`; the receiver, credentials, queues,
state and database contracts below remain app-specific. Manual deployment uses
`./deploy/host-deploy.sh sha256:<digest>`.

Engine updates, application registration, failure inspection and service rollback
are documented in [deploy-core](https://github.com/kylescudder/deploy-core).
There are no vendored engine files, lock files or sync PRs. Do not install an
app-specific LaunchAgent. Apply future engine changes once through the central service.

Every push to `main` runs **Release**. CI checks frontend/server TypeScript,
ESLint, formatting, database-backed voting behavior, webhook authentication and
host deployment gates. GitHub builds native AMD64/ARM64 images, publishes an
immutable GHCR manifest and attests its provenance. The workflow succeeds only
when the public API reports that commit in `X-Office-Tracker-Revision` and the host
acknowledges the same commit and image digest after completed acceptance checks.

## Services and trust boundaries

- Public app: https://office.kylescudder.co.uk, upstream `office-tracker:3000`.
- Deploy hook: https://deploy-office.kylescudder.co.uk/hooks/office-tracker.
- Checkout: `/Users/kyle/platform/apps/office-tracker`.
- LaunchAgent: `com.kylescudder.deploy-core`, running as Colima's owner.
- Deployer: the centrally installed service; application behavior lives in `hooks.py`.
- Image: `ghcr.io/kylescudder/thursday-office-tracker@sha256:<digest>`.

The TanStack Start app and its tRPC API share one non-root container on `platform-web`
and internal `platform-db`, with no host ports. Its read-only filesystem,
128 MiB / 0.5 CPU limit, bounded logs and four-connection pool remain in place.
Weeks use `Europe/London`. Voting keeps its existing open, name-based model.

The receiver joins only `platform-web`, has no Docker socket, host shell
credentials or database access, and can write only its queue. It reads only the
completed release acknowledgement from a separate read-only mount. It checks exact
paths, HMAC-SHA256 signatures, a five-minute timestamp window, request size and
queue bounds. Cloudflare Access protects the whole deploy hostname with one
Service Auth policy allowing only `github-office-tracker-deploy`.

Before sending a deployment, GitHub verifies that Access blocks unauthenticated
requests, authenticated unrelated paths return 404, and an invalid HMAC reaches
the receiver but is rejected. The host independently verifies provenance for
`kylescudder/thursday-office-tracker`, `.github/workflows/release.yml`,
`refs/heads/main` and GitHub-hosted runners before pulling the exact digest.
Deployments are serialized; queued requests coalesce to the newest request.

## Database and recovery

The database is `office_tracker`, registered for weekly encrypted NAS
backups. Initial provisioning uses
`python3 /Users/kyle/platform/scripts/provision-project.py office_tracker`.
Protected credentials stay in `/Users/kyle/platform/projects/office_tracker/`.
Only `runtime-password` is mounted into the app. Owner credentials are mounted
only into the one-shot migration container; database credentials never enter
GitHub, the image, receiver or webhook.

After verifying an image, the host saves a private pre-deploy `pg_dump`, retains
the latest 14 dumps, runs owner migrations and waits for application health.
It then checks HTML, built JS/CSS, API revision/cache headers, restricted database
permissions, voting/updating, history, invalid input and deletion. Each check
uses a unique temporary vote and removes it, including on failure. The verifier
uses one database connection, leaving room within the runtime role's eight-connection
limit for the four-connection app pool and separate one-connection health probe. Only completed
checks publish `state/public/deployment.json`; the protected hook GET exposes
only its revision and immutable image reference. CI requires both that exact
acknowledgement and the public API revision, preventing an early green release.
A failed migration leaves the current app running. Failed application acceptance
restores the previous image. Migrations are not reversed, so schema changes
must remain compatible with the previous runtime. Success pins the image in
`.env` and records it in `state/deployment.json` and `state/history.log`.
The shared encrypted NAS backup includes private configuration and deployment
code. Historical Convex votes were not imported; the database started empty.
The old Netlify project was deleted on 17 October 2026.
The retired Convex project `thursday-office-tracker` was also deleted, after a
full export of its only deployment, `useful-frog-526`, including file storage.
There was no production deployment. The 32 historical votes remain only in the
protected archive `secrets/convex-retirement/useful-frog-526-full.zip`; its ZIP
CRC and inclusion in the decrypted, checksum-verified encrypted NAS backup were
checked before deletion. They were not imported into Postgres.

pg-view at https://db.kylescudder.co.uk has a saved `Office Tracker` connection
to `postgres:5432`, database `office_tracker`, user `office_tracker_runtime`,
with its password saved privately. Use the project owner only for migrations.
Rollback uses retained host image digests and Postgres backups; the deleted
Netlify/Convex services and historical Netlify DNS target are not rollback paths.

## Configuration and commands

GitHub's `production` environment permits `main` only, with no required reviewer.
Its secrets are `DEPLOY_WEBHOOK_SECRET`, `CF_ACCESS_CLIENT_ID` and
`CF_ACCESS_CLIENT_SECRET`. Repository variables are `DEPLOY_ENABLED=true` and
`OFFICE_BASE_URL=https://office.kylescudder.co.uk`.

The host's `.env.deploy-hook`, `secrets/deploy-webhook-secret` and
`secrets/cloudflare-access.json` are protected files ignored by Git and Docker.
`state/cloudflare-resources.json` records resource IDs and token expiry. Renew
the dedicated one-year token before expiry and update both GitHub Access
secrets together. Never print secrets or resolved Compose output.

From the checkout:

```sh
docker compose -f deploy/compose.deploy-hook.yaml --env-file .env.deploy-hook up -d --wait
launchctl print gui/501/com.kylescudder.deploy-core
tail -n 100 state/deploy.log
docker compose --env-file .env ps
```

Pause automatic deployment:

```sh
gh variable set DEPLOY_ENABLED --body false --repo kylescudder/thursday-office-tracker
```

Redeploy or roll back to a previously attested main digest:

```sh
./deploy/host-deploy.sh sha256:<verified-main-digest>
```

The older `deploy/release.py office-tracker:<local-release>` command remains
available for operator-built local releases and shares the automatic deployer's
lock. Prefer attested digests for normal operation. Retain previous images.

Host `deploy/` tooling and Compose changes require a reviewed checkout update,
receiver recreation or LaunchAgent reinstallation. Routine image releases do
not execute host scripts downloaded from the image. No self-hosted GitHub
runner is installed. Colima and Kyle's login session must be running; reboot
recovery follows `/Users/kyle/platform/runbook.md`.

Access must exist before registering the exact hook route. From the platform:

```sh
python3 scripts/hostname.py add office-tracker-deploy deploy-office.kylescudder.co.uk --upstream office-tracker-deploy-hook:9000 --path /hooks/office-tracker --dry-run
python3 scripts/hostname.py add office-tracker-deploy deploy-office.kylescudder.co.uk --upstream office-tracker-deploy-hook:9000 --path /hooks/office-tracker
```

## Database connection budget

The runtime role is limited to eight PostgreSQL connections. Application work
uses at most four, health checks at most one, and deployment verification or
database CLI work at most one. Sequential deployment commands use their own
one-connection client instead of importing the application pool. This leaves
two slots for operator connections during a release; owner migrations use a
separate role.

CI exercises the real deployment client against an eight-connection test role,
with all four application slots held open. Concurrent deployment queries must
share one backend, health must still connect, two spare slots must remain usable,
and a ninth connection must be rejected by PostgreSQL.
