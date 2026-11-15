import { defineConfig, devices } from '@playwright/test'

// e2e/run.ts provisions the database, runs migrations and seeds it, then starts
// this suite. The app is served from the production build, as in Docker.
const port = Number(process.env.E2E_PORT ?? 4173)
const baseURL = `http://127.0.0.1:${port}`
// E2E_EVIDENCE=1 keeps a screenshot and video of every test, for PR evidence.
const evidence = process.env.E2E_EVIDENCE === '1'

export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.spec\.ts/,
  // Tests share one database, so run them in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  outputDir: 'test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ...(evidence
      ? [['json', { outputFile: 'test-results/results.json' }] as const]
      : [])
  ],
  use: {
    baseURL,
    locale: 'en-US',
    timezoneId: 'Europe/London',
    trace: 'retain-on-failure',
    screenshot: evidence ? 'on' : 'only-on-failure'
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        ...(evidence
          ? { video: { mode: 'on', size: { width: 1280, height: 800 } } }
          : {})
      }
    },
    {
      // A narrow Chromium viewport. It does not stand in for iOS Safari.
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        ...(evidence
          ? { video: { mode: 'on', size: { width: 390, height: 844 } } }
          : {})
      }
    }
  ],
  webServer: {
    command: `${process.env.E2E_BUN ?? 'bun'} server/index.ts`,
    url: `${baseURL}/healthz`,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 60_000,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      NODE_ENV: 'production',
      PORT: String(port),
      TZ: 'Europe/London',
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? '',
      // Empty means unset for the server's env schema.
      DATABASE_PASSWORD_FILE: '',
      OFFICE_TRACKER_REVISION: 'e2e'
    }
  }
})
