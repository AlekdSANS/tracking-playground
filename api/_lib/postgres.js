import crypto from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { loadLocalEnv } from './loadLocalEnv.js'

loadLocalEnv()

export const DUPLICATE_LOGIN_CONSTRAINT = 'users_login_unique'
export const DUPLICATE_EMAIL_CONSTRAINT = 'users_email_unique_idx'
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
    SELECT user_id, login, name, email, pass, email_verified_at,
      admin_status, created_at, updated_at
    FROM users
    WHERE login = ${login}
    LIMIT 1
  `

  return rows[0] || null
}

async function insertUser({
  userId,
  login,
  name,
  email,
  pass,
  verificationTokenHash,
  verificationExpiresAt,
  chooseAdmin,
}) {
  const sql = getSql()
  const rows = chooseAdmin
    ? await sql`
        INSERT INTO users (
          user_id,
          login,
          name,
          email,
          pass,
          email_verification_token_hash,
          email_verification_expires_at,
          verification_sent_at,
          admin_status
        )
        VALUES (
          ${userId},
          ${login},
          ${name},
          ${email},
          ${pass},
          ${verificationTokenHash},
          ${verificationExpiresAt},
          now(),
          CASE WHEN EXISTS (SELECT 1 FROM users) THEN 0 ELSE 1 END
        )
        RETURNING user_id, login, name, email, email_verified_at,
          admin_status, created_at, updated_at
      `
    : await sql`
        INSERT INTO users (
          user_id,
          login,
          name,
          email,
          pass,
          email_verification_token_hash,
          email_verification_expires_at,
          verification_sent_at,
          admin_status
        )
        VALUES (
          ${userId},
          ${login},
          ${name},
          ${email},
          ${pass},
          ${verificationTokenHash},
          ${verificationExpiresAt},
          now(),
          0
        )
        RETURNING user_id, login, name, email, email_verified_at,
          admin_status, created_at, updated_at
      `

  return rows[0]
}

export async function createUser({
  login,
  name,
  email,
  pass,
  verificationTokenHash,
  verificationExpiresAt,
}) {
  const userId = crypto.randomUUID()
  const values = {
    userId,
    login,
    name,
    email,
    pass,
    verificationTokenHash,
    verificationExpiresAt,
  }

  try {
    return await insertUser({ ...values, chooseAdmin: true })
  } catch (error) {
    // Two first registrations can race. The partial unique index selects one
    // administrator; the other registration is retried as a basic account.
    if (error.code === '23505' && error.constraint === SINGLE_ADMIN_INDEX) {
      return insertUser({ ...values, chooseAdmin: false })
    }

    throw error
  }
}

export function isDuplicateLoginError(error) {
  return error?.code === '23505' && error?.constraint === DUPLICATE_LOGIN_CONSTRAINT
}

export function isDuplicateEmailError(error) {
  return error?.code === '23505' && error?.constraint === DUPLICATE_EMAIL_CONSTRAINT
}

export async function verifyUserEmail(tokenHash) {
  const sql = getSql()
  const rows = await sql`
    UPDATE users
    SET email_verified_at = now(),
      email_verification_token_hash = NULL,
      email_verification_expires_at = NULL,
      updated_at = now()
    WHERE email_verification_token_hash = ${tokenHash}
      AND email_verification_expires_at > now()
      AND email_verified_at IS NULL
    RETURNING user_id, login, name, email, email_verified_at, admin_status
  `

  return rows[0] || null
}

export async function prepareEmailVerification({
  email,
  verificationTokenHash,
  verificationExpiresAt,
}) {
  const sql = getSql()
  const rows = await sql`
    UPDATE users
    SET email_verification_token_hash = ${verificationTokenHash},
      email_verification_expires_at = ${verificationExpiresAt},
      verification_sent_at = now(),
      updated_at = now()
    WHERE email = ${email}
      AND email_verified_at IS NULL
      AND (
        verification_sent_at IS NULL
        OR verification_sent_at < now() - interval '60 seconds'
      )
    RETURNING user_id, name, email
  `

  return rows[0] || null
}
