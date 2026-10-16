# Office tracker on Herman

Public URL: https://office.kylescudder.co.uk
Checkout: `/Users/kyle/platform/apps/office-tracker`.
The Vite frontend and Bun API share one process at `office-tracker:3000` on
`platform-web`. Only the app and PostgreSQL use internal `platform-db`.
No application or database port is published on Herman.

The database is `proj_office_tracker`. Provision it once with
`python3 /Users/kyle/platform/scripts/provision-project.py office_tracker`.
The provisioner registers it for the platform's encrypted weekly NAS backups.
Owner and runtime passwords stay in protected files under
`/Users/kyle/platform/projects/office_tracker/`; the application receives only
`runtime-password` as a read-only secret. Never print these files or resolved
Compose output. Migrations run in a temporary container with the owner role.

The app uses four pooled connections and a 128 MiB / 0.5 CPU runtime limit.
It runs as Herman's non-root UID/GID 501:20 to read the protected mounted secret,
with a read-only root filesystem, dropped capabilities and bounded logs.
The Bun base image is pinned by digest in the Dockerfile. The runtime contains
only the built frontend and server source; frontend dependencies stay in the
build stage. Weeks follow `Europe/London` time.

## Release

From the checkout, select an immutable release tag, usually the Git commit:

```sh
docker build -t office-tracker:<commit> .
python3 deploy/release.py office-tracker:<commit>
docker compose --env-file .release.env ps
```

The script resolves the image tag to its immutable ID, runs the idempotent
migration with owner credentials, then starts the app with runtime credentials.
It checks the database-backed API and frontend before recording success in
`deploy/state/release.json`. A failed startup restores the previous image.
For a failed initial release it removes only the app, retaining the database.
Migrations must remain compatible with the previous runtime; schema changes
are not reversed by an image rollback.

The ignored `.release.env` selects the running image. The release record retains
the prior selection. To roll back manually, tag that recorded image ID as
`office-tracker:rollback-<commit>` and pass that tag to `deploy/release.py`.
Retain previous image IDs; do not prune images during a release.
GitHub pushes do not deploy automatically.

## Hostname and checks

Register only after the container is healthy, from `/Users/kyle/platform`:

```sh
python3 scripts/hostname.py add office-tracker office.kylescudder.co.uk --upstream office-tracker:3000 --dry-run
python3 scripts/hostname.py add office-tracker office.kylescudder.co.uk --upstream office-tracker:3000
```

Check public HTTPS, the frontend's JS/CSS assets, `/api/votes/current`,
`/api/votes/history`, vote creation/update/deletion, and persistence after
restarting only this app. Remove any verification vote afterwards.
Confirm an existing site still responds. Caddy/Cloudflare handle public TLS.
Hostname removal retains the container and database.

The tracker keeps its existing open, name-based voting model; there is no login.
Historical Convex data needs a separate import; this deployment does not delete
or modify the old service. Host reboot and NAS backup availability follow
`/Users/kyle/platform/runbook.md`.
