import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { BookOpen, CheckCircle2, Eye, RotateCw } from 'lucide-react'
import { Button, ButtonLink, Card, Spinner } from '../components/ui'
import { openLesson, saveLessonProgress } from '../lib/db'
import { findQuestions } from '../lib/questions'
import { lessonsForQuestion } from '../lib/learning'
import { CHAPTERS, type LessonProgress, type Question } from '../lib/types'
import { useAuth } from '../store/auth'

/** A question-specific explainer guarantees that every question has teaching support. */
export default function QuestionLesson() {
  const { questionId = '' } = useParams()
  const [question, setQuestion] = useState<Question | null | undefined>(undefined)
  const [progress, setProgress] = useState<LessonProgress | null>(null)
  const [shown, setShown] = useState(false)
  const [chosen, setChosen] = useState<number[]>([])
  useEffect(() => { void findQuestions([questionId]).then((items) => setQuestion(items[0] ?? null)); void openLesson(`question:${questionId}`).then(setProgress) }, [questionId])
  if (question === undefined || !progress) return <Spinner label="Opening explanation" />
  if (!question) return <Navigate to="/study/learn" replace />
  const correct = chosen.length === question.correct.length && chosen.every((choice) => question.correct.includes(choice))
  const answered = chosen.length === question.correct.length
  const choose = async (choice: number) => {
    const next = question.type === 'multi' ? (chosen.includes(choice) ? chosen.filter((item) => item !== choice) : [...chosen, choice]) : [choice]
    setChosen(next)
    if (next.length === question.correct.length) {
      const nextProgress = { ...progress, quiz: { ...(progress.quiz ?? {}), [question.id]: next.every((item) => question.correct.includes(item)) } }
      setProgress(nextProgress); await saveLessonProgress(nextProgress); void useAuth.getState().syncUp()
    }
  }
  const related = lessonsForQuestion(question.id, `${question.section} ${question.question} ${question.tags.join(' ')}`)
  return <div className="mx-auto max-w-3xl space-y-5"><ButtonLink to="/study/mistakes" variant="ghost" className="px-0">← Back to mistakes</ButtonLink><header><p className="eyebrow">{CHAPTERS.find((chapter) => chapter.id === question.chapter)?.short} · {question.section}</p><h1 className="mt-1 text-2xl font-semibold text-navy">Understand this answer</h1></header><Card><h2 className="font-medium">{question.question}</h2><Button variant="secondary" className="mt-4" onClick={() => setShown(true)}><Eye size={16} />Show the answer</Button>{shown && <div className="mt-4"><p className="font-medium text-good">{question.correct.map((index) => question.options[index]).join(', ')}</p><p className="mt-3 text-sm leading-relaxed text-muted">{question.explanation}</p><p className="mt-3 text-xs text-muted">Read the explanation in your own words, then hide it and recall the answer.</p></div>}</Card><Card><h2 className="font-semibold">Check yourself</h2><p className="mt-1 text-sm text-muted">Answer without looking back. This does not affect your test score.</p><div className="mt-4 grid gap-2">{question.options.map((option, index) => <Button key={option} variant={answered ? question.correct.includes(index) ? 'primary' : chosen.includes(index) ? 'danger' : 'secondary' : 'secondary'} className="justify-start text-left" disabled={answered} onClick={() => void choose(index)}>{option}</Button>)}</div>{answered && <p className={`mt-3 text-sm ${correct ? 'text-good' : 'text-bad'}`}>{correct ? 'Correct — you recalled it without the explanation.' : `Correct answer: ${question.correct.map((index) => question.options[index]).join(', ')}`}</p>}</Card><Card><h2 className="flex items-center gap-2 font-semibold"><BookOpen size={18} className="text-accent" />Learn the wider topic</h2>{related.map((lesson) => <Link key={lesson.id} to={`/study/learn/${lesson.id}`} className="mt-3 block text-sm font-medium text-brand hover:underline">{lesson.title}</Link>)}<div className="mt-4 flex flex-wrap gap-2"><ButtonLink to="/study/flashcards" variant="secondary"><RotateCw size={16} />Review flashcards</ButtonLink><ButtonLink to="/practice" variant="secondary">Practise more</ButtonLink><Button onClick={async () => { const next = { ...progress, completedAt: Date.now(), quiz: progress.quiz ?? {} }; setProgress(next); await saveLessonProgress(next); void useAuth.getState().syncUp() }}><CheckCircle2 size={16} />Mark understood</Button></div></Card></div>
}
