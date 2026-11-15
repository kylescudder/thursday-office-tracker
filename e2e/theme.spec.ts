import { expect, test } from './fixtures'

test('the theme can be changed from the app bar and is kept on reload', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)

  await page.getByRole('button', { name: 'Toggle theme' }).click()
  await page.getByRole('menuitem', { name: 'Light' }).click()
  await expect(page.locator('html')).toHaveClass(/\blight\b/)

  await page.reload()
  await expect(page.locator('html')).toHaveClass(/\blight\b/)

  await page.getByRole('button', { name: 'Toggle theme' }).click()
  await page.getByRole('menuitem', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
})
