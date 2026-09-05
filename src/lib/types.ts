/** Shared domain types. Imported by both the client and the Hono server. */

export type QuestionType = 'single' | 'multi' | 'boolean'
export type ChapterId = 1 | 2 | 3 | 4 | 5
export type Difficulty = 1 | 2 | 3

export interface Question {
  id: string
  type: QuestionType
  /** `multi` questions state how many to pick in the stem, as the real test does. */
  question: string
  options: string[]
  /** Indices into `options`. Exactly one entry unless `type === 'multi'`. */
  correct: number[]
  explanation: string
  chapter: ChapterId
  section: string
  difficulty: Difficulty
  tags: string[]
}

export interface Chapter {
  id: ChapterId
  title: string
  short: string
  /** Share of a 24-question exam drawn from this chapter. Sums to 1. */
  weight: number
}

/** Mirrors the real exam: 24 questions, 45 minutes, 18 correct to pass. */
export const EXAM = { questionCount: 24, durationMs: 45 * 60 * 1000, passMark: 18 } as const

export const CHAPTERS: Chapter[] = [
  { id: 1, title: 'The values and principles of the UK', short: 'Values', weight: 0.08 },
  { id: 2, title: 'What is the UK?', short: 'What is the UK?', weight: 0.06 },
  { id: 3, title: 'A long and illustrious history', short: 'History', weight: 0.4 },
  { id: 4, title: 'A modern, thriving society', short: 'Society', weight: 0.28 },
  { id: 5, title: 'The UK government, the law and your role', short: 'Government', weight: 0.18 },
]

export type TestMode =
  | 'mock'        // 24 questions, timed, official rules
  | 'chapter'     // one chapter, untimed
  | 'weak'        // drawn from questions you have got wrong
  | 'rapid'       // 10 questions, quick
  | 'endless'     // runs until you stop
  | 'custom'

export interface AnswerRecord {
  questionId: string
  chosen: number[]
  correct: boolean
  /** Milliseconds spent on this question. */
  timeMs: number
}

export interface Attempt {
  id: string
  mode: TestMode
  chapters: ChapterId[]
  score: number
  total: number
  passed: boolean
  durationMs: number
  takenAt: number
  answers: AnswerRecord[]
  /** False until the attempt has been pushed to the server. */
  synced?: boolean
}

/** A reusable test assembled by the learner in the custom-test builder. */
export interface CustomTestPreset {
  id: string
  name: string
  chapters: ChapterId[]
  count: number
  difficulty: Difficulty[]
  timed: boolean
  rapid: boolean
  focusWeak: boolean
  createdAt: number
  lastUsedAt: number
}

/** SM-2 scheduling state for a single question. */
export interface SrsState {
  questionId: string
  ease: number
  intervalDays: number
  repetitions: number
  dueAt: number
  lapses: number
}

export interface User {
  id: string
  email: string | null
  username: string | null
  displayName: string | null
  createdAt: number
}

/** Preferences used to turn a broad revision goal into a practical routine. */
export interface StudyProfile {
  examDate: string | null
  dailyMinutes: number
  /** ISO weekday numbers: Monday = 1, Sunday = 7. */
  preferredWeekdays: number[]
  timezone: string
}

export interface ReadinessComponent {
  key: 'performance' | 'coverage' | 'recency' | 'volume'
  label: string
  value: number
  weight: number
  explanation: string
}

export interface ReadinessSummary {
  indicator: number | null
  state: 'insufficient-evidence' | 'ready'
  components: ReadinessComponent[]
  explanation: string
}

/** Authored teaching content, kept separate from exam questions and scores. */
export interface Lesson {
  id: string
  chapter: ChapterId
  title: string
  topic: string
  summary: string
  minutes: number
  keywords: string[]
  facts: { heading: string; text: string }[]
  memoryAid: { title: string; text: string }
  recall: { prompt: string; answer: string }
  questionIds: string[]
}

export interface LessonProgress {
  lessonId: string
  startedAt: number
  completedAt: number | null
  lastOpenedAt: number
  recalls: Record<number, 'remembered' | 'nearly' | 'forgot'>
}
