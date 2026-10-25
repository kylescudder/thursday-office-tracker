import '@tanstack/react-start/server-only'
import { asc, and, desc, eq } from 'drizzle-orm'
import { db } from './database'
import { votes } from './schema'

export const VOTE_OPTIONS = ['yes', 'no', 'could-be-convinced'] as const
export type VoteOption = (typeof VOTE_OPTIONS)[number]

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
export async function getCurrentWeekVotes() {
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
export async function getVoteHistory() {
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
export async function addVote(name: string, option: VoteOption) {
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
export async function deleteVote(name: string) {
  const weekStart = getWeekStart(new Date())
  await db
    .delete(votes)
    .where(and(eq(votes.weekStart, weekStart), eq(votes.name, name)))
}
