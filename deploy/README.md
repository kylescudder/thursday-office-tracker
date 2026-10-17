# Office tracker on Herman

Every push to `main` runs **Release**. CI checks frontend/server TypeScript,
ESLint, formatting, database-backed voting behavior, webhook authentication and
host deployment gates. GitHub builds native AMD64/ARM64 images, publishes an
immutable GHCR manifest and attests its provenance. The workflow succeeds only
when the public API reports that commit in `X-Office-Tracker-Revision`.

## Services and trust boundaries

- Public app: https://office.kylescudder.co.uk, upstream `office-tracker:3000`.
- Deploy hook: https://deploy-office.kylescudder.co.uk/hooks/office-tracker.
- Checkout: `/Users/kyle/platform/apps/office-tracker`.
- LaunchAgent: `com.herman.office-tracker-deploy`, running as Colima's owner.
- Image: `ghcr.io/kylescudder/thursday-office-tracker@sha256:<digest>`.

The Vite frontend and Bun API share one non-root container on `platform-web`
and internal `platform-db`, with no host ports. Its read-only filesystem,
128 MiB / 0.5 CPU limit, bounded logs and four-connection pool remain in place.
Weeks use `Europe/London`. Voting keeps its existing open, name-based model.

The receiver joins only `platform-web`, has no Docker socket, host shell
credentials or database access, and can write only its queue. It checks exact
paths, HMAC-SHA256 signatures, a five-minute timestamp window, request size and
queue bounds. Cloudflare Access protects the whole deploy hostname with one
Service Auth policy allowing only `github-office-tracker-deploy`.

Before sending a deployment, GitHub verifies that Access blocks unauthenticated
requests, authenticated unrelated paths return 404, and an invalid HMAC reaches
the receiver but is rejected. Herman independently verifies provenance for
`kylescudder/thursday-office-tracker`, `.github/workflows/release.yml`,
`refs/heads/main` and GitHub-hosted runners before pulling the exact digest.
Deployments are serialized; queued requests coalesce to the newest request.

## Database and recovery

The database is `proj_office_tracker`, registered for weekly encrypted NAS
backups. Initial provisioning uses
`python3 /Users/kyle/platform/scripts/provision-project.py office_tracker`.
Protected credentials stay in `/Users/kyle/platform/projects/office_tracker/`.
Only `runtime-password` is mounted into the app. Owner credentials are mounted
only into the one-shot migration container; database credentials never enter
GitHub, the image, receiver or webhook.

After verifying an image, Herman saves a private pre-deploy `pg_dump`, retains
the latest 14 dumps, runs owner migrations and waits for application health.
A failed migration leaves the current app running. Failed application health
restores the previous image. Migrations are not reversed, so schema changes
must remain compatible with the previous runtime. Success pins the image in
`.env` and records it in `state/deployment.json` and `state/history.log`.
The shared encrypted NAS backup includes private configuration and deployment
code. Historical Convex votes were not imported; the database started empty.
The old Netlify project was deleted on 17 October 2026.

## Configuration and commands

GitHub's `production` environment permits `main` only, with no required reviewer.
Its secrets are `DEPLOY_WEBHOOK_SECRET`, `CF_ACCESS_CLIENT_ID` and
`CF_ACCESS_CLIENT_SECRET`. Repository variables are `DEPLOY_ENABLED=true` and
`OFFICE_BASE_URL=https://office.kylescudder.co.uk`.

Herman's `.env.deploy-hook`, `secrets/deploy-webhook-secret` and
`secrets/cloudflare-access.json` are protected files ignored by Git and Docker.
`state/cloudflare-resources.json` records resource IDs and token expiry. Renew
the dedicated one-year token before expiry and update both GitHub Access
secrets together. Never print secrets or resolved Compose output.

From the checkout:

```sh
docker compose -f deploy/compose.deploy-hook.yaml --env-file .env.deploy-hook up -d --wait
python3 -B deploy/install-launchd.py
launchctl print gui/501/com.herman.office-tracker-deploy
tail -n 100 state/deploy.log
docker compose --env-file .env ps
```

Pause automatic deployment:

```sh
gh variable set DEPLOY_ENABLED --body false --repo kylescudder/thursday-office-tracker
```

Redeploy or roll back to a previously attested main digest:

```sh
./deploy/herman-deploy.sh sha256:<verified-main-digest>
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
