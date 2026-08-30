import Dexie, { type EntityTable } from 'dexie'
import type { ActiveTestSnapshot, Attempt, CustomTestPreset, MistakeOverride, SrsState } from './types'

/**
 * Local-first storage. Everything works with no account at all; when someone
 * signs in, this is the source that gets merged up to the server.
 */
class LiukDatabase extends Dexie {
  attempts!: EntityTable<Attempt, 'id'>
  srs!: EntityTable<SrsState, 'questionId'>
  prefs!: EntityTable<{ key: string; value: unknown }, 'key'>
  activeTest!: EntityTable<ActiveTestSnapshot, 'id'>

  constructor() {
    super('life-in-the-uk')
    this.version(1).stores({
      attempts: 'id, takenAt, mode, synced',
      srs: 'questionId, dueAt',
      prefs: 'key',
    })
    // v2 adds a singleton table for resuming an in-progress test after a
    // refresh or a closed tab. Existing installs upgrade with no data loss.
    this.version(2).stores({
      attempts: 'id, takenAt, mode, synced',
      srs: 'questionId, dueAt',
      prefs: 'key',
      activeTest: 'id',
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

/** Every attempt ever recorded on this device, used to build the mistake bank. */
export async function allAttempts(): Promise<Attempt[]> {
  return db.attempts.toArray()
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
  return row && row.value != null ? (row.value as T) : fallback
}

export async function setPref(key: string, value: unknown) {
  await db.prefs.put({ key, value })
}

const CUSTOM_TESTS_KEY = 'custom-test-presets'

export async function customTestPresets(): Promise<CustomTestPreset[]> {
  const presets = await getPref<CustomTestPreset[]>(CUSTOM_TESTS_KEY, [])
  if (!Array.isArray(presets)) return []
  return [...presets].sort((a, b) => b.lastUsedAt - a.lastUsedAt)
}

/** Replaces duplicate names and keeps a bounded list of recent presets. */
export async function saveCustomTestPreset(preset: CustomTestPreset) {
  const existing = await customTestPresets()
  const next = [
    preset,
    ...existing.filter(
      (item) => item.id !== preset.id && item.name.toLowerCase() !== preset.name.toLowerCase(),
    ),
  ].slice(0, 20)
  await setPref(CUSTOM_TESTS_KEY, next)
}

export async function touchCustomTestPreset(preset: CustomTestPreset): Promise<CustomTestPreset> {
  const updated = { ...preset, lastUsedAt: Date.now() }
  await saveCustomTestPreset(updated)
  return updated
}

export async function deleteCustomTestPreset(id: string) {
  const existing = await customTestPresets()
  await setPref(CUSTOM_TESTS_KEY, existing.filter((p) => p.id !== id))
}

export async function clearLocalProgress() {
  await Promise.all([db.attempts.clear(), db.srs.clear()])
}

// -------------------------------------------------------------- active test

const ACTIVE_TEST_ID = 'current'

export async function saveActiveTest(snapshot: Omit<ActiveTestSnapshot, 'id'>) {
  await db.activeTest.put({ ...snapshot, id: ACTIVE_TEST_ID })
}

export async function loadActiveTest(): Promise<ActiveTestSnapshot | null> {
  const row = await db.activeTest.get(ACTIVE_TEST_ID)
  return row ?? null
}

export async function clearActiveTest() {
  await db.activeTest.delete(ACTIVE_TEST_ID)
}

// ------------------------------------------------------------ mistake bank

const MISTAKE_OVERRIDES_KEY = 'mistake-overrides'

export async function mistakeOverrides(): Promise<Record<string, MistakeOverride>> {
  const overrides = await getPref<Record<string, MistakeOverride>>(MISTAKE_OVERRIDES_KEY, {})
  return overrides && typeof overrides === 'object' ? overrides : {}
}

/** Pass `null` to clear back to the automatic (score-derived) state. */
export async function setMistakeOverride(questionId: string, override: MistakeOverride | null) {
  const current = await mistakeOverrides()
  const next = { ...current }
  if (override) next[questionId] = override
  else delete next[questionId]
  await setPref(MISTAKE_OVERRIDES_KEY, next)
}
