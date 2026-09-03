import crypto from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { loadLocalEnv } from './loadLocalEnv.js'

loadLocalEnv()

export const DUPLICATE_LOGIN_CONSTRAINT = 'users_login_unique'
const SINGLE_ADMIN_INDEX = 'users_single_admin_idx'

let sqlClient

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured')
  }

  if (!sqlClient) {
    sqlClient = neon(databaseUrl)
  }

  return sqlClient
}

export async function findUserByLogin(login) {
  const sql = getSql()
  const rows = await sql`
    SELECT user_id, login, name, pass, admin_status, created_at, updated_at
    FROM users
    WHERE login = ${login}
    LIMIT 1
  `

  return rows[0] || null
}

async function insertUser({ userId, login, name, pass, chooseAdmin }) {
  const sql = getSql()
  const rows = chooseAdmin
    ? await sql`
        INSERT INTO users (user_id, login, name, pass, admin_status)
        VALUES (
          ${userId},
          ${login},
          ${name},
          ${pass},
          CASE WHEN EXISTS (SELECT 1 FROM users) THEN 0 ELSE 1 END
        )
        RETURNING user_id, login, name, admin_status, created_at, updated_at
      `
    : await sql`
        INSERT INTO users (user_id, login, name, pass, admin_status)
        VALUES (${userId}, ${login}, ${name}, ${pass}, 0)
        RETURNING user_id, login, name, admin_status, created_at, updated_at
      `

  return rows[0]
}

export async function createUser({ login, name, pass }) {
  const userId = crypto.randomUUID()

  try {
    return await insertUser({ userId, login, name, pass, chooseAdmin: true })
  } catch (error) {
    // Two first registrations can race. The partial unique index selects one
    // administrator; the other registration is retried as a basic account.
    if (error.code === '23505' && error.constraint === SINGLE_ADMIN_INDEX) {
      return insertUser({ userId, login, name, pass, chooseAdmin: false })
    }

    throw error
  }
}

export function isDuplicateLoginError(error) {
  return error?.code === '23505' && error?.constraint === DUPLICATE_LOGIN_CONSTRAINT
}

