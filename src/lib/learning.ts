import { LESSONS } from '../data/lessons'
import type { Attempt, Lesson, LessonProgress } from './types'

export interface LessonRecommendation { lesson: Lesson; reason: string; score: number }

export function recommendLessons(attempts: Attempt[], progress: LessonProgress[]): LessonRecommendation[] {
  const completed = new Set(progress.filter((p) => p.completedAt).map((p) => p.lessonId))
  const recent = [...attempts].sort((a,b) => b.takenAt-a.takenAt).slice(0, 12)
  return LESSONS.map((lesson) => {
    const wrong = recent.flatMap((a) => a.answers).filter((a) => !a.correct && (lesson.questionIds.includes(a.questionId) || a.questionId.startsWith(`c${lesson.chapter}-`))).length
    const p = progress.find((item) => item.lessonId === lesson.id)
    const confusing = p ? Object.values(p.recalls).filter((v) => v === 'forgot').length : 0
    const score = confusing * 8 + wrong * 4 + (p && !p.completedAt ? 2 : 0) + (!p ? 1 : 0)
    const reason = confusing ? 'You marked this as difficult.' : wrong ? `Linked to ${wrong} recent mistake${wrong === 1 ? '' : 's'}.` : p && !p.completedAt ? 'Continue where you left off.' : 'A useful starting lesson.'
    return { lesson, reason, score }
  }).filter((item) => !completed.has(item.lesson.id) || item.score > 0).sort((a,b) => b.score-a.score).slice(0,3)
}

export function lessonsForQuestion(questionId: string, context = '') {
  const direct = LESSONS.filter((lesson) => lesson.questionIds.includes(questionId))
  if (direct.length) return direct
  const chapter = Number(/^c([1-5])-/.exec(questionId)?.[1])
  if (!chapter) return []
  const words = new Set(context.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2))
  const candidates = LESSONS.filter((lesson) => lesson.chapter === chapter)
  return candidates
    .map((lesson) => ({ lesson, score: [lesson.topic, lesson.title, ...lesson.keywords].reduce((score, text) => score + [...words].filter((word) => text.toLowerCase().includes(word)).length, 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 1)
    .map(({ lesson }) => lesson)
}
