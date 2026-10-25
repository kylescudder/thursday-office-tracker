import { asc, and, desc, eq } from 'drizzle-orm'
import { db, sql, url } from './database'
import { votes } from './schema'
import { createHealthCheck } from './health'
import path from 'path'

const VOTE_OPTIONS = ['yes', 'no', 'could-be-convinced'] as const
type VoteOption = (typeof VOTE_OPTIONS)[number]

function json(value: unknown, init?: ResponseInit): Response {
  const response = Response.json(value, init)
  response.headers.set(
    'X-Office-Tracker-Revision',
    process.env.OFFICE_TRACKER_REVISION || 'development'
  )
  response.headers.set('Cache-Control', 'no-store')
  return response
}

// Fail before accepting traffic if the database or migration is unavailable.
await sql`SELECT id FROM votes LIMIT 0`

// Get the start of the current week (Monday)
function getWeekStart(date: Date): number {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Get current week's votes
async function getCurrentWeekVotes() {
  const weekStart = getWeekStart(new Date())
  return db
    .select({
      id: votes.id,
      name: votes.name,
      option: votes.option,
      timestamp: votes.timestamp
    })
    .from(votes)
    .where(eq(votes.weekStart, weekStart))
    .orderBy(asc(votes.timestamp))
}

// Get all votes grouped by week (newest first)
async function getVoteHistory() {
  const allVotes = await db
    .select()
    .from(votes)
    .orderBy(desc(votes.weekStart), asc(votes.timestamp))

  const weekMap = new Map<number, typeof allVotes>()
  for (const vote of allVotes) {
    weekMap.set(vote.weekStart, [...(weekMap.get(vote.weekStart) || []), vote])
  }

  return Array.from(weekMap.entries()).map(([weekStart, votes]) => ({
    weekStart,
    votes: votes.map((v) => ({
      name: v.name,
      option: v.option,
      timestamp: v.timestamp
    }))
  }))
}

// Add a new vote, or update the user's existing vote for this week
async function addVote(name: string, option: VoteOption) {
  const now = new Date()
  const [vote] = await db
    .insert(votes)
    .values({
      name,
      option,
      weekStart: getWeekStart(now),
      timestamp: now.getTime()
    })
    .onConflictDoUpdate({
      target: [votes.weekStart, votes.name],
      set: { option, timestamp: now.getTime() }
    })
    .returning({ id: votes.id })
  return vote!.id
}

// Delete a vote (for changing vote)
async function deleteVote(name: string) {
  const weekStart = getWeekStart(new Date())
  await db
    .delete(votes)
    .where(and(eq(votes.weekStart, weekStart), eq(votes.name, name)))
}

const distDir = path.resolve(import.meta.dir, '../dist')
const indexHtml = Bun.file(path.join(distDir, 'index.html'))
const checkHealth = createHealthCheck(url.toString())

const server = Bun.serve({
  hostname: '0.0.0.0',
  port: Number(process.env.PORT || 3000),
  routes: {
    '/healthz': {
      GET: async () => {
        try {
          await checkHealth()
        } catch {
          return json({ ok: false }, { status: 503 })
        }
        return json({
          ok: true,
          revision: process.env.OFFICE_TRACKER_REVISION || 'development'
        })
      }
    },
    '/api/votes/current': {
      GET: async () => json(await getCurrentWeekVotes())
    },
    '/api/votes/history': {
      GET: async () => json(await getVoteHistory())
    },
    '/api/votes': {
      POST: async (req) => {
        const { name, option } = (await req.json()) as {
          name: unknown
          option: VoteOption
        }
        if (typeof name !== 'string' || !name.trim()) {
          return json({ error: 'name is required' }, { status: 400 })
        }
        if (!VOTE_OPTIONS.includes(option)) {
          return json({ error: 'invalid option' }, { status: 400 })
        }
        return json({ id: await addVote(name, option) })
      },
      DELETE: async (req) => {
        const { name } = (await req.json()) as { name: unknown }
        if (typeof name !== 'string') {
          return json({ error: 'name is required' }, { status: 400 })
        }
        await deleteVote(name)
        return new Response(null, { status: 204 })
      }
    }
  },
  // Serve the built frontend, falling back to index.html for client routes
  async fetch(req) {
    const { pathname } = new URL(req.url)
    if (pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 })
    }
    const file = Bun.file(path.join(distDir, path.normalize(pathname)))
    if (pathname !== '/' && (await file.exists())) {
      return new Response(file)
    }
    return new Response(indexHtml)
  }
})

console.log(`Server listening on ${server.url}`)
