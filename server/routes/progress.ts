import { Hono } from 'hono'
import { pool, query } from '../db.ts'
import { requireAuth, type SessionUser } from '../auth.ts'
import type { Attempt, SrsState, StudyProfile } from '../../src/lib/types.ts'

export const progressRoutes = new Hono<{ Variables: { user: SessionUser } }>()

progressRoutes.use('*', requireAuth)

function validProfile(profile: StudyProfile): string | null {
  if (profile.examDate != null) {
    const parsed = new Date(`${profile.examDate}T00:00:00Z`)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(profile.examDate) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== profile.examDate
    ) return 'Choose a valid exam date.'
  }
  if (!Number.isInteger(profile.dailyMinutes) || profile.dailyMinutes < 5 || profile.dailyMinutes > 180)
    return 'Daily study time must be between 5 and 180 minutes.'
  if (
    !Array.isArray(profile.preferredWeekdays) || profile.preferredWeekdays.length === 0 ||
    profile.preferredWeekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)
  ) return 'Preferred study days are invalid.'
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: profile.timezone })
  } catch {
    return 'Choose a valid timezone.'
  }
  return null
}

async function saveProfile(userId: string, profile: StudyProfile) {
  const error = validProfile(profile)
  if (error) throw new Error(error)
  const rows = await query<{
    examDate: string | null
    dailyMinutes: number
    preferredWeekdays: number[]
    timezone: string
  }>(
    `INSERT INTO learner_profiles (user_id, exam_date, daily_minutes, preferred_weekdays, timezone)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       exam_date = EXCLUDED.exam_date,
       daily_minutes = EXCLUDED.daily_minutes,
       preferred_weekdays = EXCLUDED.preferred_weekdays,
       timezone = EXCLUDED.timezone,
       updated_at = now()
     RETURNING exam_date::text AS "examDate", daily_minutes AS "dailyMinutes",
               preferred_weekdays AS "preferredWeekdays", timezone`,
    [userId, profile.examDate, profile.dailyMinutes, [...new Set(profile.preferredWeekdays)], profile.timezone],
  )
  return rows[0]!
}

progressRoutes.put('/profile', async (c) => {
  const profile = await c.req.json<StudyProfile>()
  const error = validProfile(profile)
  if (error) return c.json({ error }, 400)
  return c.json({ profile: await saveProfile(c.get('user').id, profile) })
})

/**
 * Upserts attempts by the client-generated id, so the same payload can be sent
 * twice - on retry, or when a guest signs in and their local history is merged -
 * without creating duplicates.
 */
async function saveAttempts(userId: string, attempts: Attempt[]) {
  if (!pool || attempts.length === 0) return
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const a of attempts) {
      const { rows } = await client.query<{ id: string; inserted: boolean }>(
        `INSERT INTO attempts (user_id, client_id, mode, chapters, score, total, passed, duration_ms, taken_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9 / 1000.0))
         ON CONFLICT (user_id, client_id) DO UPDATE SET score = EXCLUDED.score
         RETURNING id, (xmax = 0) AS inserted`,
        [
          userId,
          a.id,
          a.mode,
          a.chapters ?? [],
          a.score,
          a.total,
          a.passed,
          a.durationMs,
          a.takenAt,
        ],
      )
      const attemptId = rows[0]!.id
      // Only write the answer rows the first time; a re-sync of the same
      // attempt must not double up its answers.
      if (!rows[0]!.inserted) continue

      for (const ans of a.answers) {
        await client.query(
          `INSERT INTO answers (attempt_id, question_id, chosen, correct, time_ms)
           VALUES ($1, $2, $3, $4, $5)`,
          [attemptId, ans.questionId, ans.chosen, ans.correct, Math.round(ans.timeMs)],
        )
      }
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

progressRoutes.post('/attempts', async (c) => {
  const body = await c.req.json<{ attempts: Attempt[] }>()
  await saveAttempts(c.get('user').id, body.attempts ?? [])
  return c.json({ ok: true, saved: body.attempts?.length ?? 0 })
})

progressRoutes.get('/attempts', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)
  const rows = await query(
    `SELECT client_id AS id, mode, chapters, score, total, passed,
            duration_ms AS "durationMs",
            (extract(epoch FROM taken_at) * 1000)::bigint AS "takenAt"
       FROM attempts WHERE user_id = $1
      ORDER BY taken_at DESC LIMIT $2`,
    [c.get('user').id, limit],
  )
  return c.json({ attempts: rows.map((r) => ({ ...r, takenAt: Number(r.takenAt) })) })
})

/** Full account state used to restore progress after signing in on a device. */
progressRoutes.get('/snapshot', async (c) => {
  const userId = c.get('user').id
  const attempts = await query<Attempt & { serverId: string }>(
    `SELECT id AS "serverId", client_id AS id, mode, chapters, score, total, passed,
            duration_ms AS "durationMs",
            (extract(epoch FROM taken_at) * 1000)::bigint AS "takenAt"
       FROM attempts WHERE user_id = $1
      ORDER BY taken_at ASC`,
    [userId],
  )
  const answers = await query<{
    attemptId: string
    questionId: string
    chosen: number[]
    correct: boolean
    timeMs: number
  }>(
    `SELECT attempt_id AS "attemptId", question_id AS "questionId", chosen, correct,
            time_ms AS "timeMs"
       FROM answers
      WHERE attempt_id IN (SELECT id FROM attempts WHERE user_id = $1)
      ORDER BY id`,
    [userId],
  )
  const byAttempt = new Map<string, typeof answers>()
  for (const answer of answers) {
    const list = byAttempt.get(answer.attemptId) ?? []
    list.push(answer)
    byAttempt.set(answer.attemptId, list)
  }

  const srs = await query<SrsState>(
    `SELECT question_id AS "questionId", ease, interval_days AS "intervalDays",
            repetitions, lapses, (extract(epoch FROM due_at) * 1000)::bigint AS "dueAt"
       FROM srs WHERE user_id = $1`,
    [userId],
  )
  const profiles = await query<StudyProfile>(
    `SELECT exam_date::text AS "examDate", daily_minutes AS "dailyMinutes",
            preferred_weekdays AS "preferredWeekdays", timezone
       FROM learner_profiles WHERE user_id = $1`,
    [userId],
  )

  return c.json({
    attempts: attempts.map(({ serverId, ...attempt }) => ({
      ...attempt,
      takenAt: Number(attempt.takenAt),
      answers: (byAttempt.get(serverId) ?? []).map(({ attemptId: _attemptId, ...answer }) => answer),
      synced: true,
    })),
    srs: srs.map((row) => ({ ...row, dueAt: Number(row.dueAt) })),
    profile: profiles[0] ?? null,
  })
})

/** Everything the stats dashboard needs, in one round trip. */
progressRoutes.get('/stats', async (c) => {
  const userId = c.get('user').id

  const [totals] = await query<{ attempts: string; passed: string; best: number | null }>(
    `SELECT count(*) AS attempts,
            count(*) FILTER (WHERE passed) AS passed,
            max(round(score::numeric * 100 / nullif(total, 0))) AS best
       FROM attempts WHERE user_id = $1 AND mode = 'mock'`,
    [userId],
  )

  const perQuestion = await query<{ questionId: string; asked: string; right: string }>(
    `SELECT a.question_id AS "questionId",
            count(*) AS asked,
            count(*) FILTER (WHERE a.correct) AS "right"
       FROM answers a JOIN attempts t ON t.id = a.attempt_id
      WHERE t.user_id = $1
      GROUP BY a.question_id`,
    [userId],
  )

  return c.json({
    mockAttempts: Number(totals?.attempts ?? 0),
    mockPassed: Number(totals?.passed ?? 0),
    bestPercent: totals?.best ?? null,
    perQuestion: perQuestion.map((r) => ({
      questionId: r.questionId,
      asked: Number(r.asked),
      right: Number(r.right),
    })),
  })
})

progressRoutes.get('/srs', async (c) => {
  const rows = await query(
    `SELECT question_id AS "questionId", ease, interval_days AS "intervalDays",
            repetitions, lapses, (extract(epoch FROM due_at) * 1000)::bigint AS "dueAt"
       FROM srs WHERE user_id = $1`,
    [c.get('user').id],
  )
  return c.json({ srs: rows.map((r) => ({ ...r, dueAt: Number(r.dueAt) })) })
})

progressRoutes.put('/srs', async (c) => {
  const body = await c.req.json<{ srs: SrsState[] }>()
  if (!pool) return c.json({ ok: false }, 503)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const s of body.srs ?? []) {
      await client.query(
        `INSERT INTO srs (user_id, question_id, ease, interval_days, repetitions, lapses, due_at)
         VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))
         ON CONFLICT (user_id, question_id) DO UPDATE SET
           ease = EXCLUDED.ease, interval_days = EXCLUDED.interval_days,
           repetitions = EXCLUDED.repetitions, lapses = EXCLUDED.lapses,
           due_at = EXCLUDED.due_at`,
        [
          c.get('user').id,
          s.questionId,
          s.ease,
          s.intervalDays,
          s.repetitions,
          s.lapses,
          s.dueAt,
        ],
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  return c.json({ ok: true })
})

/** Called once after signup or first login, to adopt guest-mode progress. */
progressRoutes.post('/merge', async (c) => {
  const body = await c.req.json<{ attempts: Attempt[]; srs: SrsState[]; profile?: StudyProfile | null }>()
  const userId = c.get('user').id

  await saveAttempts(userId, body.attempts ?? [])

  // On merge, keep whichever schedule is further along rather than clobbering.
  for (const s of body.srs ?? []) {
    await query(
      `INSERT INTO srs (user_id, question_id, ease, interval_days, repetitions, lapses, due_at)
       VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))
       ON CONFLICT (user_id, question_id) DO UPDATE SET
         ease = EXCLUDED.ease,
         interval_days = greatest(srs.interval_days, EXCLUDED.interval_days),
         repetitions = greatest(srs.repetitions, EXCLUDED.repetitions),
         lapses = greatest(srs.lapses, EXCLUDED.lapses),
         due_at = greatest(srs.due_at, EXCLUDED.due_at)`,
      [userId, s.questionId, s.ease, s.intervalDays, s.repetitions, s.lapses, s.dueAt],
    )
  }

  if (body.profile) {
    const error = validProfile(body.profile)
    if (error) return c.json({ error }, 400)
    await saveProfile(userId, body.profile)
  }

  return c.json({ ok: true, merged: body.attempts?.length ?? 0 })
})
