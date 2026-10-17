# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/f1b8576f-8ba9-4674-a7b9-3bead34c851f

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/f1b8576f-8ba9-4674-a7b9-3bead34c851f) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

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
See [the Herman deployment guide](deploy/README.md) for the container, database and release commands.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Bun + Postgres

## How can I deploy this project?

Push changes through a pull request. After CI passes, merging to `main` starts
the Release workflow, which publishes an attested container image and deploys
it to Herman. The workflow verifies the live API reports the exact commit.

Production runs at [office.kylescudder.co.uk](https://office.kylescudder.co.uk).
The frontend and API use one Bun process with a private Postgres database.
GitHub holds deployment credentials only; database credentials stay on Herman.

See [the deployment guide](deploy/README.md) for configuration, migration,
release verification and rollback. The former Netlify project has been removed.
