import { sql } from './database'
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

type VoteRow = {
  id: number
  name: string
  option: VoteOption
  week_start: string
  timestamp: string
}

// Get current week's votes
async function getCurrentWeekVotes() {
  const weekStart = getWeekStart(new Date())
  const votes: VoteRow[] = await sql`
    SELECT * FROM votes WHERE week_start = ${weekStart} ORDER BY timestamp
  `

  return votes.map((vote) => ({
    id: vote.id,
    name: vote.name,
    option: vote.option,
    timestamp: Number(vote.timestamp)
  }))
}

// Get all votes grouped by week (newest first)
async function getVoteHistory() {
  const allVotes: VoteRow[] = await sql`
    SELECT * FROM votes ORDER BY week_start DESC, timestamp
  `

  const weekMap = new Map<number, VoteRow[]>()
  for (const vote of allVotes) {
    const weekStart = Number(vote.week_start)
    weekMap.set(weekStart, [...(weekMap.get(weekStart) || []), vote])
  }

  return Array.from(weekMap.entries()).map(([weekStart, votes]) => ({
    weekStart,
    votes: votes.map((v) => ({
      name: v.name,
      option: v.option,
      timestamp: Number(v.timestamp)
    }))
  }))
}

// Add a new vote, or update the user's existing vote for this week
async function addVote(name: string, option: VoteOption) {
  const now = new Date()
  const [vote] = await sql`
    INSERT INTO votes (name, option, week_start, timestamp)
    VALUES (${name}, ${option}, ${getWeekStart(now)}, ${now.getTime()})
    ON CONFLICT (week_start, name)
    DO UPDATE SET option = EXCLUDED.option, timestamp = EXCLUDED.timestamp
    RETURNING id
  `
  return vote.id as number
}

// Delete a vote (for changing vote)
async function deleteVote(name: string) {
  const weekStart = getWeekStart(new Date())
  await sql`DELETE FROM votes WHERE week_start = ${weekStart} AND name = ${name}`
}

const distDir = path.resolve(import.meta.dir, '../dist')
const indexHtml = Bun.file(path.join(distDir, 'index.html'))

const server = Bun.serve({
  hostname: '0.0.0.0',
  port: Number(process.env.PORT || 3000),
  routes: {
    '/healthz': {
      GET: async () => {
        try {
          // Fail before the server's idle timeout drops the request.
          await Promise.race([
            sql`SELECT id FROM votes LIMIT 0`,
            Bun.sleep(3000).then(() => Promise.reject(new Error('timeout')))
          ])
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
