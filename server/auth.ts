import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { query } from './db.ts'

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

export const SESSION_COOKIE = 'liuk_session'
/** Deliberately long: the cheapest way to avoid password resets is to not log people out. */
export const SESSION_DAYS = 90
/** Intentionally lax, per product decision. Six characters is the whole rule. */
export const MIN_PASSWORD_LENGTH = 6

// ---------------------------------------------------------------- passwords

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), 64)
  const expected = Buffer.from(keyHex, 'hex')
  return key.length === expected.length && timingSafeEqual(key, expected)
}

// ----------------------------------------------------------- recovery codes

/** Human-transcribable alphabet: no O/0, I/1, or similar look-alikes. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRecoveryCode(): string {
  const bytes = randomBytes(12)
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
  const groups = [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)]
  return `LIUK-${groups.map((g) => g.join('')).join('-')}`
}

/**
 * Only the 12 random characters are significant. The `LIUK` prefix is dropped
 * before hashing so that mistyping it - `L1UK` is the obvious slip - does not
 * lock someone out of their own account.
 */
export function normaliseCode(code: string): string {
  const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return cleaned.length > 12 ? cleaned.slice(-12) : cleaned
}

/** The code carries ~60 bits of entropy, so a fast hash is appropriate. */
export function hashCode(code: string): string {
  return createHash('sha256').update(normaliseCode(code)).digest('hex')
}

export function codeMatches(code: string, storedHash: string): boolean {
  const a = Buffer.from(hashCode(code), 'hex')
  const b = Buffer.from(storedHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function hashAnswer(answer: string): string {
  return createHash('sha256').update(answer.trim().toLowerCase()).digest('hex')
}

// ---------------------------------------------------------------- sessions

export interface SessionUser {
  id: string
  email: string | null
  username: string | null
  display_name: string | null
  created_at: Date
}

export async function createSession(c: Context, userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [
    token,
    userId,
    expiresAt,
  ])
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  })
}

export async function destroySession(c: Context) {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await query('DELETE FROM sessions WHERE token = $1', [token])
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export async function getSessionUser(c: Context): Promise<SessionUser | null> {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return null

  const rows = await query<SessionUser & { expires_at: Date }>(
    `SELECT u.id, u.email, u.username, u.display_name, u.created_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > now()`,
    [token],
  )
  const row = rows[0]
  if (!row) return null

  // Sliding renewal: refresh once the session is under half its life.
  const halfLife = Date.now() + (SESSION_DAYS / 2) * 86_400_000
  if (row.expires_at.getTime() < halfLife) {
    const next = new Date(Date.now() + SESSION_DAYS * 86_400_000)
    await query('UPDATE sessions SET expires_at = $1 WHERE token = $2', [next, token])
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_DAYS * 86_400,
    })
  }

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    display_name: row.display_name,
    created_at: row.created_at,
  }
}

export const requireAuth: MiddlewareHandler<{ Variables: { user: SessionUser } }> = async (
  c,
  next,
) => {
  const user = await getSessionUser(c)
  if (!user) return c.json({ error: 'Not signed in' }, 401)
  c.set('user', user)
  await next()
}

// ------------------------------------------------------------ rate limiting

const buckets = new Map<string, { count: number; resetAt: number }>()

/**
 * In-memory fixed-window limiter. Enough to stop trivial brute forcing of
 * six-character passwords on a single-instance deployment; if this ever runs
 * on more than one Railway replica, move it to Postgres or Redis.
 */
export function rateLimit(max: number, windowMs: number): MiddlewareHandler {
  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown'
    const key = `${c.req.path}:${ip}`
    const now = Date.now()
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
    } else if (bucket.count >= max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
      c.header('Retry-After', String(retryAfter))
      return c.json({ error: 'Too many attempts. Please wait a moment and try again.' }, 429)
    } else {
      bucket.count += 1
    }

    await next()
  }
}

// Keep the limiter map from growing without bound.
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) if (bucket.resetAt < now) buckets.delete(key)
}, 60_000).unref()
