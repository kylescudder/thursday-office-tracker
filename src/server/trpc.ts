import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import {
  addVote,
  deleteVote,
  getCurrentWeekVotes,
  getVoteHistory,
  VOTE_OPTIONS
} from './votes'

const t = initTRPC.create()

export const appRouter = t.router({
  votes: t.router({
    current: t.procedure.query(() => getCurrentWeekVotes()),
    history: t.procedure.query(() => getVoteHistory()),
    // Names are stored as typed; they only have to contain something.
    add: t.procedure
      .input(
        z.object({
          name: z
            .string()
            .refine((name) => name.trim().length > 0, 'name is required'),
          option: z.enum(VOTE_OPTIONS)
        })
      )
      .mutation(async ({ input }) => ({
        id: await addVote(input.name, input.option)
      })),
    remove: t.procedure
      .input(z.object({ name: z.string() }))
      .mutation(async ({ input }) => {
        await deleteVote(input.name)
      })
  })
})

export type AppRouter = typeof appRouter
