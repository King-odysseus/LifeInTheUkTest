import { describe, expect, it } from 'vitest'
import { deriveMistakes } from './mistakes'
import type { Attempt, MistakeOverride, Question } from './types'

function makeQuestion(id: string): Question {
  return {
    id,
    type: 'single',
    question: `Question ${id}`,
    options: ['A', 'B', 'C', 'D'],
    correct: [0],
    explanation: `Explanation for ${id}`,
    chapter: 1,
    section: 'Section',
    difficulty: 1,
    tags: [],
  }
}

function makeAttempt(
  takenAt: number,
  answers: { questionId: string; chosen: number[]; correct: boolean }[],
): Attempt {
  return {
    id: `attempt-${takenAt}`,
    mode: 'custom',
    chapters: [],
    score: answers.filter((a) => a.correct).length,
    total: answers.length,
    passed: false,
    durationMs: 1000,
    takenAt,
    answers: answers.map((a) => ({ ...a, timeMs: 100 })),
    synced: false,
  }
}

const questionsById = new Map([
  ['q1', makeQuestion('q1')],
  ['q2', makeQuestion('q2')],
])
const noOverrides: Record<string, MistakeOverride> = {}

describe('deriveMistakes', () => {
  it('ignores questions that have never been missed', () => {
    const attempts = [makeAttempt(1, [{ questionId: 'q1', chosen: [0], correct: true }])]
    expect(deriveMistakes(attempts, questionsById, noOverrides)).toHaveLength(0)
  })

  it('merges repeated misses on the same question into one entry with an occurrence count', () => {
    const attempts = [
      makeAttempt(1, [{ questionId: 'q1', chosen: [1], correct: false }]),
      makeAttempt(2, [{ questionId: 'q1', chosen: [2], correct: false }]),
    ]
    const mistakes = deriveMistakes(attempts, questionsById, noOverrides)
    expect(mistakes).toHaveLength(1)
    expect(mistakes[0]?.occurrences).toBe(2)
    expect(mistakes[0]?.latestChosen).toEqual([2])
    expect(mistakes[0]?.status).toBe('open')
  })

  it('auto-resolves a mistake once the most recent attempt for it is correct', () => {
    const attempts = [
      makeAttempt(1, [{ questionId: 'q1', chosen: [1], correct: false }]),
      makeAttempt(2, [{ questionId: 'q1', chosen: [0], correct: true }]),
    ]
    const mistakes = deriveMistakes(attempts, questionsById, noOverrides)
    expect(mistakes).toHaveLength(1)
    expect(mistakes[0]?.status).toBe('reviewed')
    expect(mistakes[0]?.occurrences).toBe(1)
    expect(mistakes[0]?.latestCorrect).toBe(true)
  })

  it('keeps a manually reviewed mistake reviewed even if it was never answered correctly', () => {
    const attempts = [makeAttempt(1, [{ questionId: 'q1', chosen: [1], correct: false }])]
    const overrides: Record<string, MistakeOverride> = { q1: 'reviewed' }
    const mistakes = deriveMistakes(attempts, questionsById, overrides)
    expect(mistakes[0]?.status).toBe('reviewed')
  })

  it('lets a manual reopen override an auto-resolved mistake', () => {
    const attempts = [
      makeAttempt(1, [{ questionId: 'q1', chosen: [1], correct: false }]),
      makeAttempt(2, [{ questionId: 'q1', chosen: [0], correct: true }]),
    ]
    const overrides: Record<string, MistakeOverride> = { q1: 'reopened' }
    const mistakes = deriveMistakes(attempts, questionsById, overrides)
    expect(mistakes[0]?.status).toBe('open')
  })

  it('sorts by occurrence count, most-missed first', () => {
    const attempts = [
      makeAttempt(1, [{ questionId: 'q1', chosen: [1], correct: false }]),
      makeAttempt(2, [{ questionId: 'q2', chosen: [1], correct: false }]),
      makeAttempt(3, [{ questionId: 'q2', chosen: [1], correct: false }]),
    ]
    const mistakes = deriveMistakes(attempts, questionsById, noOverrides)
    expect(mistakes.map((m) => m.questionId)).toEqual(['q2', 'q1'])
  })

  it('skips a mistake whose question is no longer in the current bank', () => {
    const attempts = [makeAttempt(1, [{ questionId: 'missing', chosen: [1], correct: false }])]
    expect(deriveMistakes(attempts, questionsById, noOverrides)).toHaveLength(0)
  })
})
