import { expect, test as base } from '@playwright/test'
import { resetCurrentWeekVotes } from './seed'

// Every test starts from the same database: seeded history, empty current week.
export const test = base.extend<{ finalState: void }>({
  // Evidence runs only: after each test's assertions, capture its settled final
  // state with animations finished and the pointer away from the controls.
  finalState: [
    async ({ page }, use, testInfo) => {
      await use()
      if (process.env.E2E_EVIDENCE !== '1') return
      await page.mouse.move(0, 0)
      const path = testInfo.outputPath('final-state.png')
      await page.screenshot({ path, animations: 'disabled' })
      await testInfo.attach('final-state', { path, contentType: 'image/png' })
    },
    { auto: true }
  ]
})
export { expect }

test.beforeEach(async () => {
  const databaseUrl = process.env.E2E_DATABASE_URL
  if (!databaseUrl)
    throw new Error('E2E_DATABASE_URL is not set; run bun run test:e2e')
  await resetCurrentWeekVotes(databaseUrl)
})
