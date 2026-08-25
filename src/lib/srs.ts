import { db } from './db'
import type { SrsState } from './types'

const DAY = 86_400_000

/**
 * SM-2, the SuperMemo scheduling algorithm. For a fact-heavy exam this is the
 * highest-value study feature: dates, names and figures are exactly what
 * spaced repetition is good at.
 *
 * Grades: 0 wrong, 3 correct but slow, 5 correct and quick.
 */
export function schedule(prev: SrsState | undefined, questionId: string, grade: number): SrsState {
  const state: SrsState = prev ?? {
    questionId,
    ease: 2.5,
    intervalDays: 0,
    repetitions: 0,
    dueAt: Date.now(),
    lapses: 0,
  }

  if (grade < 3) {
    // A lapse resets the interval but only nudges the ease factor down.
    return {
      ...state,
      repetitions: 0,
      intervalDays: 1,
      lapses: state.lapses + 1,
      ease: Math.max(1.3, state.ease - 0.2),
      dueAt: Date.now() + DAY,
    }
  }

  const repetitions = state.repetitions + 1
  const intervalDays =
    repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(state.intervalDays * state.ease)

  const ease = Math.max(
    1.3,
    state.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)),
  )

  return {
    ...state,
    repetitions,
    intervalDays,
    ease,
    dueAt: Date.now() + intervalDays * DAY,
  }
}

/** Correct answers grade on speed, so a hesitant recall is revisited sooner. */
export function gradeFor(correct: boolean, timeMs: number): number {
  if (!correct) return 0
  if (timeMs < 8_000) return 5
  if (timeMs < 20_000) return 4
  return 3
}

export async function recordReview(questionId: string, correct: boolean, timeMs: number) {
  const prev = await db.srs.get(questionId)
  await db.srs.put(schedule(prev, questionId, gradeFor(correct, timeMs)))
}

export async function dueQuestionIds(limit = 50): Promise<string[]> {
  return db.srs
    .where('dueAt')
    .belowOrEqual(Date.now())
    .limit(limit)
    .toArray()
    .then((rows) => rows.map((r) => r.questionId))
}

export async function dueCount(): Promise<number> {
  return db.srs.where('dueAt').belowOrEqual(Date.now()).count()
}
