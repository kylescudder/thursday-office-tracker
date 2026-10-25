if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

export const url = new URL(process.env.DATABASE_URL)
if (process.env.DATABASE_PASSWORD_FILE) {
  url.password = (
    await Bun.file(process.env.DATABASE_PASSWORD_FILE).text()
  ).trim()
}
