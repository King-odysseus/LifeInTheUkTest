import Dexie, { type EntityTable } from 'dexie'
import type { Attempt, CustomTestPreset, SrsState } from './types'

/**
 * Local-first storage. Everything works with no account at all; when someone
 * signs in, this is the source that gets merged up to the server.
 */
class LiukDatabase extends Dexie {
  attempts!: EntityTable<Attempt, 'id'>
  srs!: EntityTable<SrsState, 'questionId'>
  prefs!: EntityTable<{ key: string; value: unknown }, 'key'>

  constructor() {
    super('life-in-the-uk')
    this.version(1).stores({
      attempts: 'id, takenAt, mode, synced',
      srs: 'questionId, dueAt',
      prefs: 'key',
    })
  }
}

export const db = new LiukDatabase()

export async function saveAttempt(attempt: Attempt) {
  await db.attempts.put(attempt)
}

export async function recentAttempts(limit = 50): Promise<Attempt[]> {
  return db.attempts.orderBy('takenAt').reverse().limit(limit).toArray()
}

export async function unsyncedAttempts(): Promise<Attempt[]> {
  return db.attempts.filter((a) => !a.synced).toArray()
}

export async function markSynced(ids: string[]) {
  await db.attempts.where('id').anyOf(ids).modify({ synced: true })
}

/** Restores the server copy into this browser after account sign-in. */
export async function restoreProgress(attempts: Attempt[], srs: SrsState[]) {
  await db.transaction('rw', db.attempts, db.srs, async () => {
    if (attempts.length) await db.attempts.bulkPut(attempts.map((a) => ({ ...a, synced: true })))
    if (srs.length) await db.srs.bulkPut(srs)
  })
}

/**
 * Per-question history across every attempt, used for the weak-areas drill and
 * the stats heatmap.
 */
export async function questionHistory(): Promise<Map<string, { asked: number; right: number }>> {
  const history = new Map<string, { asked: number; right: number }>()
  await db.attempts.each((attempt) => {
    for (const answer of attempt.answers) {
      const entry = history.get(answer.questionId) ?? { asked: 0, right: 0 }
      entry.asked += 1
      if (answer.correct) entry.right += 1
      history.set(answer.questionId, entry)
    }
  })
  return history
}

/** Questions answered wrong more often than right, worst first. */
export async function weakQuestionIds(limit = 100): Promise<string[]> {
  const history = await questionHistory()
  return [...history.entries()]
    .filter(([, s]) => s.right < s.asked)
    .sort((a, b) => a[1].right / a[1].asked - b[1].right / b[1].asked)
    .slice(0, limit)
    .map(([id]) => id)
}

export async function getPref<T>(key: string, fallback: T): Promise<T> {
  const row = await db.prefs.get(key)
  return row ? (row.value as T) : fallback
}

export async function setPref(key: string, value: unknown) {
  await db.prefs.put({ key, value })
}

const CUSTOM_TESTS_KEY = 'custom-test-presets'

export async function customTestPresets(): Promise<CustomTestPreset[]> {
  const presets = await getPref<CustomTestPreset[]>(CUSTOM_TESTS_KEY, [])
  return [...presets].sort((a, b) => b.lastUsedAt - a.lastUsedAt)
}

/** Keeps the eight most recently used presets and replaces duplicate names. */
export async function saveCustomTestPreset(preset: CustomTestPreset) {
  const existing = await customTestPresets()
  const next = [
    preset,
    ...existing.filter(
      (item) => item.id !== preset.id && item.name.toLowerCase() !== preset.name.toLowerCase(),
    ),
  ].slice(0, 8)
  await setPref(CUSTOM_TESTS_KEY, next)
}

export async function touchCustomTestPreset(preset: CustomTestPreset): Promise<CustomTestPreset> {
  const updated = { ...preset, lastUsedAt: Date.now() }
  await saveCustomTestPreset(updated)
  return updated
}

export async function clearLocalProgress() {
  await Promise.all([db.attempts.clear(), db.srs.clear()])
}
