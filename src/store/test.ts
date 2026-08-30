import { create } from 'zustand'
import {
  EXAM,
  type ActiveTestSnapshot,
  type Attempt,
  type ChapterId,
  type Difficulty,
  type Question,
  type TestMode,
} from '../lib/types'
import { buildExam, isCorrect, sampleQuestions } from '../lib/questions'
import { clearActiveTest, loadActiveTest, saveActiveTest, saveAttempt, weakQuestionIds } from '../lib/db'
import { recordReview } from '../lib/srs'
import { newId } from '../lib/id'
import { useAuth } from './auth'

export interface TestConfig {
  mode: TestMode
  chapters?: ChapterId[]
  count?: number
  difficulty?: Difficulty[]
  timed?: boolean
  /** Practice modes reveal the answer immediately; the mock exam never does. */
  instantFeedback?: boolean
  /** Prioritise questions the learner has previously answered incorrectly. */
  focusWeak?: boolean
}

export type ResumeResult = 'resumed' | 'expired' | 'none'

interface TestStore {
  status: 'idle' | 'loading' | 'active' | 'review' | 'finished'
  config: TestConfig | null
  questions: Question[]
  index: number
  /** questionId -> chosen option indices */
  chosen: Record<string, number[]>
  flagged: Set<string>
  startedAt: number
  questionStartedAt: number
  /** questionId -> milliseconds spent, accumulated across visits. */
  timeSpent: Record<string, number>
  deadline: number | null
  result: Attempt | null

  start: (config: TestConfig) => Promise<void>
  select: (optionIndex: number) => void
  goto: (index: number) => void
  next: () => void
  prev: () => void
  toggleFlag: () => void
  openReview: () => void
  backToActive: () => void
  finish: () => Promise<Attempt>
  reset: () => void
  /** Restores a saved test from IndexedDB. Expired timed tests are submitted immediately. */
  resume: () => Promise<ResumeResult>
  /** Deletes a saved test without restoring it. */
  discardSaved: () => Promise<void>
}

const defaultCounts: Record<TestMode, number> = {
  mock: EXAM.questionCount,
  chapter: 20,
  weak: 20,
  rapid: 10,
  endless: 200,
  custom: 24,
}

/** Only an active or in-review test is worth persisting; anything else clears the saved slot. */
function persist(state: TestStore) {
  if ((state.status !== 'active' && state.status !== 'review') || !state.config) {
    void clearActiveTest().catch(() => undefined)
    return
  }
  const snapshot: Omit<ActiveTestSnapshot, 'id'> = {
    config: state.config,
    questions: state.questions,
    index: state.index,
    chosen: state.chosen,
    flagged: [...state.flagged],
    startedAt: state.startedAt,
    questionStartedAt: state.questionStartedAt,
    timeSpent: state.timeSpent,
    deadline: state.deadline,
    status: state.status,
    savedAt: Date.now(),
  }
  void saveActiveTest(snapshot).catch(() => undefined)
}

export const useTest = create<TestStore>((set, get) => ({
  status: 'idle',
  config: null,
  questions: [],
  index: 0,
  chosen: {},
  flagged: new Set(),
  startedAt: 0,
  questionStartedAt: 0,
  timeSpent: {},
  deadline: null,
  result: null,

  async start(config) {
    set({ status: 'loading' })
    try {
      const count = config.count ?? defaultCounts[config.mode]

      let questions: Question[]
      if (config.mode === 'mock') {
        questions = await buildExam(EXAM.questionCount)
      } else if (config.mode === 'weak' || config.focusWeak) {
        const weak = await weakQuestionIds(500)
        const prioritised = await sampleQuestions({
          only: weak,
          chapters: config.chapters,
          difficulty: config.difficulty,
          count,
        })
        // Fill any shortfall with unseen questions matching the other filters.
        const shortfall = count - prioritised.length
        const filler = shortfall > 0
          ? await sampleQuestions({
              chapters: config.chapters,
              difficulty: config.difficulty,
              exclude: prioritised.map((question) => question.id),
              count: shortfall,
            })
          : []
        questions = [...prioritised, ...filler]
      } else {
        questions = await sampleQuestions({
          chapters: config.chapters,
          difficulty: config.difficulty,
          count,
        })
      }

      const now = Date.now()
      set({
        status: 'active',
        config,
        questions,
        index: 0,
        chosen: {},
        flagged: new Set(),
        timeSpent: {},
        startedAt: now,
        questionStartedAt: now,
        deadline: config.mode === 'mock' || config.timed ? now + EXAM.durationMs : null,
        result: null,
      })
    } catch (error) {
      set({ status: 'idle' })
      throw error
    }
  },

  select(optionIndex) {
    const { questions, index, chosen } = get()
    const question = questions[index]
    if (!question) return

    const current = chosen[question.id] ?? []
    const needed = question.correct.length

    let updated: number[]
    if (needed === 1) {
      updated = [optionIndex]
    } else if (current.includes(optionIndex)) {
      updated = current.filter((i) => i !== optionIndex)
    } else if (current.length >= needed) {
      // At the limit, replace the oldest pick so the UI never dead-ends.
      updated = [...current.slice(1), optionIndex]
    } else {
      updated = [...current, optionIndex]
    }

    set({ chosen: { ...chosen, [question.id]: updated } })
  },

  goto(nextIndex) {
    const { questions, index, questionStartedAt, timeSpent } = get()
    const current = questions[index]
    const clamped = Math.max(0, Math.min(nextIndex, questions.length - 1))
    if (!current) return set({ index: clamped })

    const elapsed = Date.now() - questionStartedAt
    set({
      index: clamped,
      questionStartedAt: Date.now(),
      timeSpent: { ...timeSpent, [current.id]: (timeSpent[current.id] ?? 0) + elapsed },
    })
  },

  next() {
    get().goto(get().index + 1)
  },

  prev() {
    get().goto(get().index - 1)
  },

  toggleFlag() {
    const { questions, index, flagged } = get()
    const question = questions[index]
    if (!question) return
    const updated = new Set(flagged)
    if (updated.has(question.id)) updated.delete(question.id)
    else updated.add(question.id)
    set({ flagged: updated })
  },

  openReview() {
    // Bank the time spent on the current question before leaving it.
    get().goto(get().index)
    set({ status: 'review' })
  },

  backToActive() {
    set({ status: 'active', questionStartedAt: Date.now() })
  },

  async finish() {
    const { questions, chosen, timeSpent, startedAt, index, questionStartedAt, config } = get()

    // Fold in time on the question that was open when Submit was pressed.
    const finalTimes = { ...timeSpent }
    const current = questions[index]
    if (current) {
      finalTimes[current.id] = (finalTimes[current.id] ?? 0) + (Date.now() - questionStartedAt)
    }

    const answers = questions.map((q) => {
      const picks = chosen[q.id] ?? []
      return {
        questionId: q.id,
        chosen: picks,
        correct: isCorrect(q, picks),
        timeMs: finalTimes[q.id] ?? 0,
      }
    })

    const score = answers.filter((a) => a.correct).length
    const mode = config?.mode ?? 'custom'
    const attempt: Attempt = {
      id: newId(),
      mode,
      chapters: config?.chapters ?? [],
      score,
      total: questions.length,
      // Only a full-length mock can meaningfully pass or fail; practice modes
      // reuse the same 75% threshold for a sense of progress.
      passed:
        mode === 'mock'
          ? score >= EXAM.passMark
          : score / Math.max(questions.length, 1) >= EXAM.passMark / EXAM.questionCount,
      durationMs: Date.now() - startedAt,
      takenAt: Date.now(),
      answers,
      synced: false,
    }

    await saveAttempt(attempt)
    for (const answer of answers) {
      await recordReview(answer.questionId, answer.correct, answer.timeMs)
    }
    void useAuth.getState().syncUp()

    set({ status: 'finished', result: attempt })
    await clearActiveTest().catch(() => undefined)
    return attempt
  },

  reset() {
    set({
      status: 'idle',
      config: null,
      questions: [],
      index: 0,
      chosen: {},
      flagged: new Set(),
      timeSpent: {},
      startedAt: 0,
      deadline: null,
      result: null,
    })
    void clearActiveTest().catch(() => undefined)
  },

  async resume() {
    const snapshot = await loadActiveTest()
    if (!snapshot) return 'none'

    const expired = snapshot.deadline != null && snapshot.deadline <= Date.now()
    const now = Date.now()
    set({
      status: 'active',
      config: snapshot.config,
      questions: snapshot.questions,
      index: snapshot.index,
      chosen: snapshot.chosen,
      flagged: new Set(snapshot.flagged),
      startedAt: snapshot.startedAt,
      questionStartedAt: now,
      timeSpent: snapshot.timeSpent,
      deadline: snapshot.deadline,
      result: null,
    })

    if (expired) {
      // The clock ran out while this browser was closed. Submit safely with
      // whatever was answered rather than resuming a test whose time is gone.
      await get().finish()
      return 'expired'
    }

    set({ status: snapshot.status })
    return 'resumed'
  },

  async discardSaved() {
    await clearActiveTest()
  },
}))

// Persist after every meaningful state change so a refresh or a closed tab
// can restore exactly where the learner left off.
useTest.subscribe((state) => persist(state))
