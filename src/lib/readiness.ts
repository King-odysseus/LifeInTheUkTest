import type { Attempt, ReadinessComponent, ReadinessSummary } from './types'

const DAY = 24 * 60 * 60 * 1000

export function calculateReadiness(attempts: Attempt[], now = Date.now()): ReadinessSummary {
  if (!attempts.length) {
    return {
      indicator: null,
      state: 'insufficient-evidence',
      components: [],
      explanation: 'Complete a practice set to begin building your readiness indicator.',
    }
  }

  const recent = [...attempts].sort((a, b) => b.takenAt - a.takenAt).slice(0, 10)
  const recentMocks = recent.filter((attempt) => attempt.mode === 'mock')
  const performanceSource = recentMocks.length ? recentMocks : recent
  const performance = Math.round(
    performanceSource.reduce((sum, attempt) => sum + (attempt.score / Math.max(attempt.total, 1)) * 100, 0) /
      performanceSource.length,
  )
  const chapters = new Set<number>()
  for (const attempt of attempts) {
    attempt.chapters.forEach((chapter) => chapters.add(chapter))
    attempt.answers.forEach((answer) => {
      const chapter = Number(/^c([1-5])-/.exec(answer.questionId)?.[1])
      if (chapter) chapters.add(chapter)
    })
  }
  const coverage = Math.round((chapters.size / 5) * 100)
  const newest = Math.max(...attempts.map((attempt) => attempt.takenAt))
  const daysOld = Math.max(0, Math.floor((now - newest) / DAY))
  const recency = Math.max(0, 100 - daysOld * 10)
  const volume = Math.min(100, attempts.length * 10)

  const components: ReadinessComponent[] = [
    {
      key: 'performance', label: 'Recent performance', value: performance, weight: 0.4,
      explanation: recentMocks.length
        ? `Average across your ${recentMocks.length} recent mock test${recentMocks.length === 1 ? '' : 's'}.`
        : `Average across your ${recent.length} most recent practice attempt${recent.length === 1 ? '' : 's'}.`,
    },
    {
      key: 'coverage', label: 'Chapter coverage', value: coverage, weight: 0.25,
      explanation: `${chapters.size} of 5 handbook chapters practised.`,
    },
    {
      key: 'recency', label: 'Recency', value: recency, weight: 0.2,
      explanation: daysOld === 0 ? 'You practised today.' : `Your latest attempt was ${daysOld} day${daysOld === 1 ? '' : 's'} ago.`,
    },
    {
      key: 'volume', label: 'Practice volume', value: volume, weight: 0.15,
      explanation: `${attempts.length} completed attempt${attempts.length === 1 ? '' : 's'}; full credit at 10.`,
    },
  ]
  const indicator = Math.round(components.reduce((sum, item) => sum + item.value * item.weight, 0))
  return {
    indicator,
    state: 'ready',
    components,
    explanation:
      indicator >= 80
        ? 'Your recent evidence is strong. Keep practising until test day.'
        : indicator >= 65
          ? 'You are building a solid base. Focus on uncovered and weaker chapters.'
          : 'Keep building coverage and consistent practice before relying on mock scores.',
  }
}
