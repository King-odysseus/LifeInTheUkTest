import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Question } from '../lib/types'

const fakeQuestions: Question[] = [
  {
    id: 'a1',
    type: 'single',
    question: 'Q1',
    options: ['A', 'B', 'C', 'D'],
    correct: [0],
    explanation: 'because A',
    chapter: 1,
    section: 'S1',
    difficulty: 1,
    tags: [],
  },
  {
    id: 'a2',
    type: 'single',
    question: 'Q2',
    options: ['A', 'B', 'C', 'D'],
    correct: [1],
    explanation: 'because B',
    chapter: 1,
    section: 'S1',
    difficulty: 1,
    tags: [],
  },
  {
    id: 'a3',
    type: 'single',
    question: 'Q3',
    options: ['A', 'B', 'C', 'D'],
    correct: [2],
    explanation: 'because C',
    chapter: 1,
    section: 'S1',
    difficulty: 1,
    tags: [],
  },
]

vi.mock('../lib/questions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/questions')>()
  return {
    ...actual,
    sampleQuestions: vi.fn(async () => fakeQuestions),
    buildExam: vi.fn(async () => fakeQuestions),
  }
})

vi.mock('../store/auth', () => ({
  useAuth: { getState: () => ({ syncUp: vi.fn() }) },
}))

const flush = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('active test persistence and resume', () => {
  beforeEach(async () => {
    vi.resetModules()
  })

  it('persists progress as the learner answers and moves through the test', async () => {
    const { useTest } = await import('./test')
    const { loadActiveTest } = await import('../lib/db')

    await useTest.getState().start({ mode: 'custom', count: 3, timed: true })
    await flush()

    let snapshot = await loadActiveTest()
    expect(snapshot).not.toBeNull()
    expect(snapshot?.status).toBe('active')
    expect(snapshot?.questions).toHaveLength(3)
    expect(snapshot?.deadline).not.toBeNull()

    useTest.getState().select(0)
    await flush()
    snapshot = await loadActiveTest()
    expect(snapshot?.chosen['a1']).toEqual([0])

    useTest.getState().next()
    await flush()
    snapshot = await loadActiveTest()
    expect(snapshot?.index).toBe(1)
  })

  it('discards a saved test without restoring it', async () => {
    const { useTest } = await import('./test')
    const { loadActiveTest } = await import('../lib/db')

    await useTest.getState().start({ mode: 'custom', count: 3 })
    await flush()
    expect(await loadActiveTest()).not.toBeNull()

    await useTest.getState().discardSaved()
    expect(await loadActiveTest()).toBeNull()
  })

  it('restores a snapshot written in an earlier session, exactly as it was left', async () => {
    const { useTest } = await import('./test')
    const { saveActiveTest } = await import('../lib/db')

    await saveActiveTest({
      config: { mode: 'custom', count: 3 },
      questions: fakeQuestions,
      index: 1,
      chosen: { a1: [0] },
      flagged: ['a2'],
      startedAt: Date.now() - 1000,
      questionStartedAt: Date.now() - 500,
      timeSpent: { a1: 500 },
      deadline: null,
      status: 'active',
      savedAt: Date.now(),
    })

    const result = await useTest.getState().resume()
    expect(result).toBe('resumed')
    expect(useTest.getState().status).toBe('active')
    expect(useTest.getState().index).toBe(1)
    expect(useTest.getState().chosen['a1']).toEqual([0])
    expect(useTest.getState().flagged.has('a2')).toBe(true)
    expect(useTest.getState().deadline).toBeNull()
  })

  it('submits an expired timed test safely instead of resuming its clock', async () => {
    const { useTest } = await import('./test')
    const { saveActiveTest, loadActiveTest, allAttempts } = await import('../lib/db')

    await saveActiveTest({
      config: { mode: 'mock', timed: true },
      questions: fakeQuestions,
      index: 2,
      chosen: { a1: [0], a2: [1] },
      flagged: [],
      startedAt: Date.now() - 60_000,
      questionStartedAt: Date.now() - 5_000,
      timeSpent: { a1: 1000, a2: 1000 },
      deadline: Date.now() - 1000, // already in the past
      status: 'active',
      savedAt: Date.now() - 5_000,
    })

    const result = await useTest.getState().resume()
    expect(result).toBe('expired')
    expect(useTest.getState().status).toBe('finished')

    const attempts = await allAttempts()
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.total).toBe(3)
    expect(attempts[0]?.score).toBe(2) // a1 correct, a2 correct, a3 unanswered

    // An expired, now-finished test must never surface as resumable again.
    expect(await loadActiveTest()).toBeNull()
  })

  it('never leaves a finished test resumable', async () => {
    const { useTest } = await import('./test')
    const { loadActiveTest } = await import('../lib/db')

    await useTest.getState().start({ mode: 'custom', count: 3 })
    await flush()
    useTest.getState().select(0)
    useTest.getState().next()
    useTest.getState().select(1)
    useTest.getState().next()
    useTest.getState().select(2)
    await useTest.getState().finish()

    expect(await loadActiveTest()).toBeNull()
  })

  it('returns "none" when there is nothing saved to resume', async () => {
    const { useTest } = await import('./test')
    expect(await useTest.getState().resume()).toBe('none')
  })
})
