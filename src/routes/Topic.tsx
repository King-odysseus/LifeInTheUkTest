import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { ButtonLink, Card, Spinner } from '../components/ui'
import { loadAll } from '../lib/questions'
import { CHAPTERS, type Question } from '../lib/types'

export default function Topic() {
  const { chapterId, section = '' } = useParams()
  const chapter = Number(chapterId)
  const [questions, setQuestions] = useState<Question[] | null>(null)
  useEffect(() => { void loadAll().then((all) => setQuestions(all.filter((question) => question.chapter === chapter && question.section === section))) }, [chapter, section])
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 5) return <Navigate to="/study/learn" replace />
  if (!questions) return <Spinner label="Loading this topic" />
  return <div className="mx-auto max-w-4xl space-y-5"><ButtonLink to="/study/learn" variant="ghost" className="px-0">← Learn & Remember</ButtonLink><header><p className="eyebrow">{CHAPTERS.find((item) => item.id === chapter)?.short}</p><h1 className="mt-1 text-2xl font-semibold text-navy sm:text-3xl">{section}</h1><p className="mt-2 text-sm text-muted">{questions.length} question{questions.length === 1 ? '' : 's'} in this topic. Open each one to understand the answer and check your recall.</p></header><div className="space-y-3">{questions.map((question, index) => <Card key={question.id} className="flex items-start gap-3"><span className="mt-0.5 text-sm font-semibold text-accent">{index + 1}</span><div className="min-w-0 flex-1"><h2 className="font-medium">{question.question}</h2><p className="mt-1 text-sm text-muted">Learn the answer, then test yourself without hints.</p><ButtonLink to={`/study/question/${question.id}`} variant="secondary" className="mt-3"><BookOpen size={16} />Understand this answer</ButtonLink></div></Card>)}</div></div>
}
