import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// The app has no sign-in: anyone with the link can vote under a name they type.

// The squad card is the grandparent of its heading (heading, header, card).
const squad = (page: Page) =>
  page
    .getByRole('heading', { name: "This Week's Squad" })
    .locator('xpath=../..')

// Notifications render a visible copy and a hidden announcer copy; match the visible one.
const toast = (page: Page, text: string) =>
  page.getByRole('listitem').filter({ hasText: text })

test('a teammate can vote for Thursday, see the squad and change their vote', async ({
  page
}) => {
  await page.goto('/')
  await page.getByLabel('Your Name').fill('Morgan Lee')
  await page.getByRole('button', { name: 'Sign me up' }).click()

  await expect(toast(page, 'Vote recorded!')).toBeVisible()
  await expect(
    squad(page).getByText('Morgan Lee', { exact: true })
  ).toBeVisible()
  await expect(squad(page).getByText('Sign me up 🔥')).toBeVisible()
  await expect(page.getByLabel('Your Name')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Sign me up' })).toBeDisabled()

  await page.getByRole('button', { name: 'Change your vote' }).click()
  await expect(page.getByLabel('Your Name')).toHaveValue('Morgan Lee')
  await expect(
    squad(page).getByText('Morgan Lee', { exact: true })
  ).toHaveCount(0)

  await page.getByRole('button', { name: 'No thank you' }).click()
  await expect(squad(page).getByText('No thank you 🏠')).toBeVisible()
  await expect(
    squad(page).getByText('Morgan Lee', { exact: true })
  ).toBeVisible()
})

test('a vote is not recorded without a name', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'I could be convinced' }).click()

  await expect(toast(page, 'Hold up!')).toBeVisible()
  await expect(toast(page, 'Enter your name first, friend 👋')).toBeVisible()
  await expect(toast(page, 'Vote recorded!')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'I could be convinced' })
  ).toBeEnabled()

  // A name made only of spaces counts as no name.
  await page.getByLabel('Your Name').fill('   ')
  await page.getByRole('button', { name: 'Sign me up' }).click()
  await expect(toast(page, 'Hold up!').last()).toBeVisible()
  await expect(toast(page, 'Vote recorded!')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sign me up' })).toBeEnabled()
})

test('a failed vote says so and is not shown as recorded', async ({ page }) => {
  // A deliberate boundary: the vote request fails at the network.
  await page.route('**/api/trpc/votes.add**', (route) => route.abort())

  await page.goto('/')
  await page.getByLabel('Your Name').fill('Riley Stone')
  await page.getByRole('button', { name: 'Sign me up' }).click()

  await expect(
    toast(page, 'Failed to record vote. Please try again.')
  ).toBeVisible()
  await expect(
    squad(page).getByText('Riley Stone', { exact: true })
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sign me up' })).toBeEnabled()
})

test('a recorded vote and name survive a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Your Name').fill('Jamie Ortiz')
  await page.getByRole('button', { name: 'I could be convinced' }).click()
  await expect(
    squad(page).getByText('Jamie Ortiz', { exact: true })
  ).toBeVisible()

  await page.reload()
  await expect(
    squad(page).getByText('Jamie Ortiz', { exact: true })
  ).toBeVisible()
  await expect(squad(page).getByText('I could be convinced 👥')).toBeVisible()
  await expect(page.getByLabel('Your Name')).toBeHidden()

  await page.getByRole('button', { name: 'Change your vote' }).click()
  await expect(page.getByLabel('Your Name')).toHaveValue('Jamie Ortiz')
})

test('previous weeks list who voted each week', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Previous Weeks' })
  ).toBeVisible()

  const october = page.getByRole('heading', { name: 'Oct 26 - Nov 1' })
  await expect(october).toBeVisible()
  await expect(october.locator('..')).toContainText('4 votes')
  await expect(page.getByText('Alex Reid', { exact: true })).toBeVisible()
  await expect(page.getByText('Jordan Kim', { exact: true })).toBeVisible()

  const november = page.getByRole('heading', { name: 'Nov 2 - Nov 8' })
  await expect(november).toBeVisible()
  await expect(november.locator('..')).toContainText('3 votes')
  await expect(page.getByText('Taylor Brooks', { exact: true })).toBeVisible()
  // Sam votes in both weeks, so the name appears twice.
  await expect(page.getByText('Sam Okafor', { exact: true })).toHaveCount(2)
})
