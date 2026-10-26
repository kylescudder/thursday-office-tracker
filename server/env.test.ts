import { expect, test } from 'bun:test'
import { readDatabaseEnv, readEnv } from '../src/server/env'

const valid = { DATABASE_URL: 'postgres://fixture:password@localhost:5432/app' }

test('valid runtime settings are typed and use the app defaults', () => {
  const env = readEnv(valid)
  expect(env.PORT).toBe(3000)
  expect(env.NODE_ENV).toBe('development')
  expect(readEnv({ ...valid, PORT: '4312' }).PORT).toBe(4312)
})

test('migrations need only a valid PostgreSQL URL', () => {
  expect(
    readDatabaseEnv({ DATABASE_URL: valid.DATABASE_URL }).DATABASE_URL
  ).toBe(valid.DATABASE_URL)
  for (const DATABASE_URL of [
    undefined,
    '',
    'not-a-url',
    'https://example.com/app',
    'postgres://localhost'
  ]) {
    expect(() => readDatabaseEnv({ DATABASE_URL })).toThrow('DATABASE_URL')
  }
})

test('bad listener settings are rejected before accepting requests', () => {
  for (const PORT of ['0', '-1', '65536', '3000.5', 'invalid']) {
    expect(() => readEnv({ ...valid, PORT })).toThrow('PORT')
  }
  expect(() => readEnv({ ...valid, NODE_ENV: 'staging' })).toThrow('NODE_ENV')
})

test('configuration errors identify fields without printing secret values', () => {
  const secret = 'do-not-print-this-password'
  try {
    readEnv({
      ...valid,
      DATABASE_URL: 'https://user:' + secret + '@example.com/app'
    })
    throw new Error('invalid configuration was accepted')
  } catch (error) {
    expect((error as Error).message).toContain('DATABASE_URL')
    expect((error as Error).message).not.toContain(secret)
  }
})

test('the existing Docker password-file setting stays optional', () => {
  expect(
    readDatabaseEnv({ DATABASE_URL: valid.DATABASE_URL }).DATABASE_PASSWORD_FILE
  ).toBeUndefined()
  expect(
    readDatabaseEnv({
      DATABASE_URL: valid.DATABASE_URL,
      DATABASE_PASSWORD_FILE: '/run/secrets/database_password'
    }).DATABASE_PASSWORD_FILE
  ).toBe('/run/secrets/database_password')
})
