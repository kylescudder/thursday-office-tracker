import { join, normalize } from 'node:path'
import postgres from 'postgres'
import { url } from '../src/server/database-url'
import { createHealthCheck } from '../src/server/health'

const revision = process.env.OFFICE_TRACKER_REVISION || 'development'

// Fail before accepting traffic if the database or migration is unavailable.
const startup = postgres(url.toString(), { max: 1, onnotice: () => {} })
await startup`SELECT id FROM votes LIMIT 0`
await startup.end()

const clientDirectory = join(import.meta.dir, '../dist/client')
const serverEntry = '../dist/server/server.js'
const { default: app } = (await import(serverEntry)) as {
  default: { fetch: (request: Request) => Response | Promise<Response> }
}
const checkHealth = createHealthCheck(url.toString())

// Served before the app, so health doesn't depend on page rendering.
async function health() {
  try {
    await checkHealth()
  } catch {
    return Response.json({ ok: false }, { status: 503 })
  }
  return Response.json({ ok: true, revision })
}

async function staticFile(pathname: string) {
  const path = normalize(join(clientDirectory, decodeURIComponent(pathname)))
  if (!path.startsWith(clientDirectory + '/')) return null
  const file = Bun.file(path)
  return (await file.exists()) ? new Response(file) : null
}

const server = Bun.serve({
  hostname: '0.0.0.0',
  port: Number(process.env.PORT || 3000),
  async fetch(request) {
    const { pathname } = new URL(request.url)
    const response =
      pathname === '/healthz'
        ? await health()
        : (request.method === 'GET' &&
            pathname !== '/' &&
            !pathname.startsWith('/api/') &&
            (await staticFile(pathname))) ||
          (await app.fetch(request))
    response.headers.set('X-Office-Tracker-Revision', revision)
    if (pathname === '/healthz' || pathname.startsWith('/api/'))
      response.headers.set('Cache-Control', 'no-store')
    return response
  }
})

console.log(`Server listening on ${server.url}`)
