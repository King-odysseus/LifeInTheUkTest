import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { ButtonLink, Card, Spinner } from '../components/ui'
import { loadAll } from '../lib/questions'
import { recentAttempts } from '../lib/db'
import { lessonsForQuestion } from '../lib/learning'
import type { Question } from '../lib/types'

export default function Mistakes() {
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [ids, setIds] = useState<string[]>([])
  useEffect(() => { void Promise.all([loadAll(), recentAttempts(100)]).then(([q, a]) => {
    setQuestions(q); const counts = new Map<string, number>()
    a.forEach((attempt) => attempt.answers.forEach((answer) => { if (!answer.correct) counts.set(answer.questionId, (counts.get(answer.questionId) ?? 0) + 1) }))
    setIds([...counts.entries()].sort((a,b) => b[1] - a[1]).map(([id]) => id))
  }) }, [])
  if (!questions) return <Spinner label="Loading your mistakes" />
  const byId = new Map(questions.map((q) => [q.id, q]))
  return <div className="mx-auto max-w-3xl space-y-5"><header><p className="eyebrow">Review mistakes</p><h1 className="mt-1 text-2xl font-semibold text-navy">Return to difficult facts</h1><p className="mt-1 text-sm text-muted">These are questions you have answered incorrectly. Lessons give the fact more context.</p></header>{ids.length ? ids.map((id) => { const q = byId.get(id); if (!q) return null; const lessons = lessonsForQuestion(id); return <Card key={id}><h2 className="font-medium">{q.question}</h2><p className="mt-2 text-sm text-good">Correct: {q.correct.map((i) => q.options[i]).join(', ')}</p><p className="mt-2 text-sm text-muted">{q.explanation}</p>{lessons.length ? <div className="mt-4 flex flex-wrap gap-2">{lessons.map((lesson) => <ButtonLink key={lesson.id} to={`/study/learn/${lesson.id}`} variant="secondary"><BookOpen size={16} />Learn: {lesson.title}</ButtonLink>)}</div> : <ButtonLink to="/study/learn" variant="secondary" className="mt-4">Browse lessons</ButtonLink>}</Card> }) : <Card><h2 className="font-medium">No mistakes to review yet</h2><p className="mt-1 text-sm text-muted">Complete a practice set and missed questions will appear here.</p><ButtonLink to="/practice" className="mt-4">Start practice</ButtonLink></Card>}</div>
}
