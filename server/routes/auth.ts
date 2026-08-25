import { Hono } from 'hono'
import { query } from '../db.ts'
import {
  MIN_PASSWORD_LENGTH,
  codeMatches,
  createSession,
  destroySession,
  generateRecoveryCode,
  getSessionUser,
  hashAnswer,
  hashCode,
  hashPassword,
  rateLimit,
  requireAuth,
  verifyPassword,
  type SessionUser,
} from '../auth.ts'

interface UserRow {
  id: string
  email: string | null
  username: string | null
  display_name: string | null
  created_at: Date
  password_hash: string
  recovery_hash: string
  security_question: string | null
  security_answer_hash: string | null
}

const publicUser = (u: {
  id: string
  email: string | null
  username: string | null
  display_name: string | null
  created_at: Date
}) => ({
  id: u.id,
  email: u.email,
  username: u.username,
  displayName: u.display_name,
  createdAt: u.created_at.getTime(),
})

/**
 * Signup is deliberately minimal: a username or email, and a
 * password of at least six characters. No verification, no confirm field, no
 * strength rules. The recovery code returned here is the only way back in if
 * the password is forgotten, since there is no email delivery.
 */
export const authRoutes = new Hono<{ Variables: { user: SessionUser } }>()

authRoutes.post('/signup', rateLimit(10, 60_000), async (c) => {
  const body = await c.req.json<{ identifier?: string; email?: string; password?: string }>()
  const identifier = (body.identifier ?? body.email ?? '').trim()
  const { password } = body
  const isEmail = identifier.includes('@')

  if (!identifier) return c.json({ error: 'Enter a username or email address.' }, 400)
  if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier))
    return c.json({ error: 'Enter a valid email address.' }, 400)
  if (!isEmail && !/^[A-Za-z0-9._-]{3,30}$/.test(identifier))
    return c.json({ error: 'Username must be 3–30 letters, numbers, dots, dashes or underscores.' }, 400)
  if (!password || password.length < MIN_PASSWORD_LENGTH)
    return c.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, 400)

  const existing = await query(
    `SELECT 1 FROM users
      WHERE email_lower = lower($1) OR username_lower = lower($1)`,
    [identifier],
  )
  if (existing.length) return c.json({ error: 'That username or email is already in use.' }, 409)

  const recoveryCode = generateRecoveryCode()
  const rows = await query<UserRow>(
    `INSERT INTO users (email, username, password_hash, recovery_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, username, display_name, created_at`,
    [isEmail ? identifier : null, isEmail ? null : identifier, await hashPassword(password), hashCode(recoveryCode)],
  )

  const user = rows[0]!
  await createSession(c, user.id)
  return c.json({ user: publicUser(user) })
})

authRoutes.post('/login', rateLimit(10, 60_000), async (c) => {
  const body = await c.req.json<{ identifier?: string; email?: string; password?: string }>()
  const identifier = (body.identifier ?? body.email ?? '').trim()
  const { password } = body
  if (!identifier || !password) return c.json({ error: 'Enter your username or email and password.' }, 400)

  const rows = await query<UserRow>(
    `SELECT id, email, username, display_name, created_at, password_hash
       FROM users WHERE email_lower = lower($1) OR username_lower = lower($1)`,
    [identifier],
  )
  const user = rows[0]
  // Same message either way so the endpoint does not confirm which emails exist.
  if (!user || !(await verifyPassword(password, user.password_hash)))
    return c.json({ error: 'Username/email or password is incorrect.' }, 401)

  await createSession(c, user.id)
  return c.json({ user: publicUser(user) })
})

authRoutes.post('/logout', async (c) => {
  await destroySession(c)
  return c.json({ ok: true })
})

authRoutes.get('/me', async (c) => {
  const user = await getSessionUser(c)
  return c.json({ user: user ? publicUser(user) : null })
})

/**
 * Password reset with no email in the loop. The caller proves ownership with
 * either the recovery code issued at signup or the answer to the security
 * question, if they set one.
 */
authRoutes.post('/reset', rateLimit(10, 60_000), async (c) => {
  const { identifier, recoveryCode, securityAnswer, newPassword } = await c.req.json<{
    identifier?: string
    recoveryCode?: string
    securityAnswer?: string
    newPassword?: string
  }>()

  if (!identifier) return c.json({ error: 'Enter your username or email address.' }, 400)
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH)
    return c.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, 400)
  if (!recoveryCode && !securityAnswer)
    return c.json({ error: 'Enter your recovery code or the answer to your security question.' }, 400)

  const rows = await query<UserRow>(
    `SELECT id, email, username, display_name, created_at, recovery_hash, security_answer_hash
       FROM users WHERE email_lower = lower($1) OR username_lower = lower($1)`,
    [identifier],
  )
  const user = rows[0]

  const ok =
    !!user &&
    ((recoveryCode && codeMatches(recoveryCode, user.recovery_hash)) ||
      (securityAnswer &&
        user.security_answer_hash != null &&
        hashAnswer(securityAnswer) === user.security_answer_hash))

  if (!ok) return c.json({ error: 'Those recovery details do not match an account.' }, 401)

  // A used recovery code is spent: issue a fresh one and hand it back.
  const nextCode = generateRecoveryCode()
  await query('UPDATE users SET password_hash = $1, recovery_hash = $2 WHERE id = $3', [
    await hashPassword(newPassword),
    hashCode(nextCode),
    user!.id,
  ])
  // Reset invalidates every existing session, including any the attacker holds.
  await query('DELETE FROM sessions WHERE user_id = $1', [user!.id])

  await createSession(c, user!.id)
  return c.json({ user: publicUser(user!), recoveryCode: nextCode })
})

/** Optional second route back in, for people who will not keep the code safe. */
authRoutes.post('/security-question', requireAuth, async (c) => {
  const { question, answer } = await c.req.json<{ question?: string; answer?: string }>()
  const user = c.get('user')

  if (!question || !answer) return c.json({ error: 'Enter a question and an answer.' }, 400)
  await query('UPDATE users SET security_question = $1, security_answer_hash = $2 WHERE id = $3', [
    question.trim(),
    hashAnswer(answer),
    user.id,
  ])
  return c.json({ ok: true })
})

/** Tells the reset screen which recovery methods this account actually has. */
authRoutes.post('/recovery-options', rateLimit(20, 60_000), async (c) => {
  const { identifier } = await c.req.json<{ identifier?: string }>()
  if (!identifier) return c.json({ error: 'Enter your username or email address.' }, 400)

  const rows = await query<{ security_question: string | null }>(
    `SELECT security_question FROM users
      WHERE email_lower = lower($1) OR username_lower = lower($1)`,
    [identifier],
  )
  // Always answers the same shape, whether or not the account exists.
  return c.json({ securityQuestion: rows[0]?.security_question ?? null })
})

/** Simple in-app password change for a user who is already signed in. */
authRoutes.post('/password', requireAuth, async (c) => {
  const { currentPassword, newPassword } = await c.req.json<{
    currentPassword?: string
    newPassword?: string
  }>()
  if (!currentPassword || !newPassword)
    return c.json({ error: 'Enter your current and new password.' }, 400)
  if (newPassword.length < MIN_PASSWORD_LENGTH)
    return c.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, 400)

  const user = c.get('user')
  const rows = await query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [user.id])
  if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].password_hash)))
    return c.json({ error: 'Current password is incorrect.' }, 401)

  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
    await hashPassword(newPassword),
    user.id,
  ])
  return c.json({ ok: true })
})

/** Issues a replacement code, invalidating the old one. */
authRoutes.post('/recovery-code', requireAuth, async (c) => {
  const user = c.get('user')
  const recoveryCode = generateRecoveryCode()
  await query('UPDATE users SET recovery_hash = $1 WHERE id = $2', [hashCode(recoveryCode), user.id])
  return c.json({ recoveryCode })
})

authRoutes.patch('/profile', requireAuth, async (c) => {
  const { displayName } = await c.req.json<{ displayName?: string }>()
  const user = c.get('user')
  await query('UPDATE users SET display_name = $1 WHERE id = $2', [
    displayName?.trim() || null,
    user.id,
  ])
  return c.json({ ok: true })
})

authRoutes.delete('/account', requireAuth, async (c) => {
  const user = c.get('user')
  await query('DELETE FROM users WHERE id = $1', [user.id])
  await destroySession(c)
  return c.json({ ok: true })
})
