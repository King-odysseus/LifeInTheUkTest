import type { Attempt, ChapterId, MistakeOverride, Question } from './types'

export type MistakeStatus = 'open' | 'reviewed'

export interface Mistake {
  questionId: string
  question: string
  options: string[]
  correct: number[]
  explanation: string
  chapter: ChapterId
  section: string
  /** Number of attempts across history where this question was answered wrong. */
  occurrences: number
  /** The learner's most recent selection for this question, across all attempts. */
  latestChosen: number[]
  latestCorrect: boolean
  lastAttemptAt: number
  status: MistakeStatus
}

/**
 * Builds the mistake bank from raw attempt history. A question only appears
 * here if it was missed at least once; repeated misses merge into a single
 * entry with an occurrence count. If the learner's most recent answer for a
 * question was correct, it auto-resolves unless a manual override says
 * otherwise (so a deliberate "reopen" survives a later correct guess).
 */
export function deriveMistakes(
  attempts: Attempt[],
  questionsById: Map<string, Question>,
  overrides: Record<string, MistakeOverride>,
): Mistake[] {
  const chronological = [...attempts].sort((a, b) => a.takenAt - b.takenAt)

  interface Stat {
    misses: number
    latestChosen: number[]
    latestCorrect: boolean
    lastAttemptAt: number
  }
  const stats = new Map<string, Stat>()

  for (const attempt of chronological) {
    for (const answer of attempt.answers) {
      const entry = stats.get(answer.questionId) ?? {
        misses: 0,
        latestChosen: [],
        latestCorrect: false,
        lastAttemptAt: 0,
      }
      if (!answer.correct) entry.misses += 1
      entry.latestChosen = answer.chosen
      entry.latestCorrect = answer.correct
      entry.lastAttemptAt = attempt.takenAt
      stats.set(answer.questionId, entry)
    }
  }

  const mistakes: Mistake[] = []
  for (const [questionId, stat] of stats) {
    if (stat.misses === 0) continue
    const question = questionsById.get(questionId)
    if (!question) continue

    const override = overrides[questionId]
    const status: MistakeStatus =
      override === 'reviewed'
        ? 'reviewed'
        : override === 'reopened'
          ? 'open'
          : stat.latestCorrect
            ? 'reviewed'
            : 'open'

    mistakes.push({
      questionId,
      question: question.question,
      options: question.options,
      correct: question.correct,
      explanation: question.explanation,
      chapter: question.chapter,
      section: question.section,
      occurrences: stat.misses,
      latestChosen: stat.latestChosen,
      latestCorrect: stat.latestCorrect,
      lastAttemptAt: stat.lastAttemptAt,
      status,
    })
  }

  return mistakes.sort((a, b) => b.occurrences - a.occurrences || b.lastAttemptAt - a.lastAttemptAt)
}
