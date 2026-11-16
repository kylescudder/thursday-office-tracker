// Runs the browser suite against a throwaway Postgres cluster and the production build.
// Set E2E_DATABASE_URL to reuse an existing disposable local database (name ending in _e2e or _test).
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import postgres from 'postgres'
import { seedVotes } from './seed'

const root = join(import.meta.dir, '..')
const owner = 'office_tracker_e2e_owner'
const database = 'office_tracker_e2e'
const postgresBinDirs = [
  process.env.E2E_PG_BIN,
  '/opt/homebrew/opt/postgresql@18/bin',
  '/opt/homebrew/opt/postgresql/bin',
  '/usr/local/opt/postgresql@18/bin',
  '/usr/local/opt/postgresql/bin'
]

function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)))
  })
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('No free port available'))
      )
    })
  })
}

function postgresBinDir(): string {
  const found = postgresBinDirs.find(
    (dir): dir is string => !!dir && existsSync(join(dir, 'initdb'))
  )
  const onPath = Bun.which('initdb')
  const dir = found ?? (onPath ? join(onPath, '..') : undefined)
  if (!dir)
    throw new Error(
      'PostgreSQL (initdb, postgres) not found; install it or set E2E_PG_BIN to its bin directory'
    )
  return dir
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

// A throwaway cluster on 127.0.0.1 only, with trust auth, removed on exit.
async function startCluster() {
  const bin = postgresBinDir()
  const dataRoot = await mkdtemp(join(tmpdir(), 'office-tracker-e2e-'))
  const dataDir = join(dataRoot, 'data')
  const port = await freePort()
  // Homebrew's postgres refuses to start without a valid locale in the environment.
  const env = { ...process.env, LC_ALL: process.env.LC_ALL || 'en_US.UTF-8' }

  const initdb = await run(
    join(bin, 'initdb'),
    ['-D', dataDir, '-U', owner, '--auth=trust', '-E', 'UTF8'],
    env
  )
  if (initdb !== 0) throw new Error('initdb failed')

  // The server's recent output, kept in memory for the startup error.
  let serverOutput = ''
  const keepOutput = (chunk: Buffer) => {
    serverOutput = (serverOutput + chunk.toString()).slice(-4000)
  }
  const server = spawn(
    join(bin, 'postgres'),
    [
      '-D',
      dataDir,
      '-h',
      '127.0.0.1',
      '-p',
      String(port),
      '-c',
      'unix_socket_directories='
    ],
    { env, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  server.stdout.on('data', keepOutput)
  server.stderr.on('data', keepOutput)
  const exited = new Promise<void>((resolve) =>
    server.once('exit', () => resolve())
  )

  const admin = postgres({
    host: '127.0.0.1',
    port,
    username: owner,
    database: 'postgres',
    max: 1,
    connect_timeout: 2,
    onnotice: () => {}
  })
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await admin`SELECT 1`
        break
      } catch (error) {
        if (attempt > 100) throw error
        await sleep(200)
      }
    }
    await admin.unsafe(`CREATE DATABASE ${database}`)
  } catch {
    server.kill('SIGINT')
    await exited
    throw new Error(`PostgreSQL did not start: ${serverOutput.slice(-800)}`)
  } finally {
    await admin.end({ timeout: 1 })
  }

  return {
    url: `postgres://${owner}@127.0.0.1:${port}/${database}`,
    async stop() {
      server.kill('SIGINT')
      await exited
      await rm(dataRoot, { recursive: true, force: true })
    }
  }
}

function assertDisposable(url: string) {
  const parsed = new URL(url)
  const local = ['127.0.0.1', 'localhost'].includes(parsed.hostname)
  const name = parsed.pathname.replace(/^\//, '')
  if (!local || !/_(e2e|test)$/.test(name))
    throw new Error(
      'E2E_DATABASE_URL must be a local database whose name ends in _e2e or _test'
    )
}

async function main(): Promise<number> {
  const cluster = process.env.E2E_DATABASE_URL
    ? undefined
    : await startCluster()
  const databaseUrl = process.env.E2E_DATABASE_URL ?? cluster!.url
  if (process.env.E2E_DATABASE_URL) assertDisposable(databaseUrl)

  try {
    const env = { ...process.env, DATABASE_URL: databaseUrl }
    if (await run(process.execPath, ['run', 'build'], env)) return 1
    if (await run(process.execPath, ['server/migrate.ts'], env)) return 1
    await seedVotes(databaseUrl)

    const port = await freePort()
    return await run(
      'node',
      [
        join(root, 'node_modules', '.bin', 'playwright'),
        'test',
        ...process.argv.slice(2)
      ],
      {
        ...process.env,
        E2E_DATABASE_URL: databaseUrl,
        E2E_PORT: String(port),
        E2E_BUN: process.execPath
      }
    )
  } finally {
    await cluster?.stop()
  }
}

process.exitCode = await main()
