import { readDatabaseEnv } from './env'

const env = readDatabaseEnv()
export const url = new URL(env.DATABASE_URL)
if (env.DATABASE_PASSWORD_FILE) {
  url.password = (await Bun.file(env.DATABASE_PASSWORD_FILE).text()).trim()
}
