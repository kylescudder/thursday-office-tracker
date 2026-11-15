import { expect, test as base } from '@playwright/test'
import { resetCurrentWeekVotes } from './seed'

// Every test starts from the same database: seeded history, empty current week.
export const test = base
export { expect }

test.beforeEach(async () => {
  const databaseUrl = process.env.E2E_DATABASE_URL
  if (!databaseUrl)
    throw new Error('E2E_DATABASE_URL is not set; run bun run test:e2e')
  await resetCurrentWeekVotes(databaseUrl)
})
