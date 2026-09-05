import { useEffect, useMemo, useState } from 'react'
import { Brain, CircleAlert, Layers3 } from 'lucide-react'
import { ButtonLink, Card, Meter, Spinner } from '../components/ui'
import { CHAPTERS, type Attempt, type LessonProgress } from '../lib/types'
import { LESSONS } from '../data/lessons'
import { lessonProgresses, recentAttempts } from '../lib/db'
import { recommendLessons } from '../lib/learning'

export default function Learn() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null)
  const [progress, setProgress] = useState<LessonProgress[] | null>(null)
  const [query, setQuery] = useState('')
  useEffect(() => { void Promise.all([recentAttempts(100), lessonProgresses()]).then(([a,p]) => { setAttempts(a); setProgress(p) }) }, [])
  const recommendations = useMemo(() => attempts && progress ? recommendLessons(attempts, progress) : [], [attempts, progress])
  if (!attempts || !progress) return <Spinner label="Loading lessons" />
  const filtered = LESSONS.filter((lesson) => `${lesson.title} ${lesson.topic} ${lesson.keywords.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  const status = (id: string) => progress.find((p) => p.lessonId === id)
  return <div className="mx-auto max-w-5xl space-y-7">
    <header><p className="eyebrow">Learn & remember</p><h1 className="mt-1 text-2xl font-semibold text-navy sm:text-3xl">Understand the facts, then recall them</h1><p className="mt-2 max-w-2xl text-sm text-muted">Short lessons connect facts with timelines, comparisons and memory aids before you practise.</p></header>
    <section><h2 className="flex items-center gap-2 font-semibold"><Brain size={19} className="text-accent" />Suggested for you</h2><div className="mt-3 grid gap-3 md:grid-cols-3">{recommendations.map(({lesson,reason}) => { const p=status(lesson.id); return <Card key={lesson.id}><p className="text-xs text-muted">{CHAPTERS.find(c=>c.id===lesson.chapter)?.short} · {lesson.minutes} min</p><h3 className="mt-2 font-semibold">{lesson.title}</h3><p className="mt-1 text-sm text-muted">{reason}</p><ButtonLink className="mt-4" to={`/study/learn/${lesson.id}`}>{p?.completedAt ? 'Review lesson' : p ? 'Continue' : 'Start lesson'}</ButtonLink></Card>})}</div></section>
    <section><label className="block text-sm font-medium">Find a lesson<input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search topics, such as Parliament" className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink" /></label></section>
    {CHAPTERS.map((chapter) => { const lessons=filtered.filter(l=>l.chapter===chapter.id); if(!lessons.length)return null; const done=lessons.filter(l=>status(l.id)?.completedAt).length; return <section key={chapter.id}><div className="flex items-end justify-between gap-3"><div><h2 className="font-semibold">{chapter.short}</h2><p className="text-sm text-muted">{chapter.title}</p></div><span className="text-xs text-muted">{done}/{lessons.length} completed</span></div><Meter value={done} max={lessons.length} label={`${chapter.short} lesson progress`} /><div className="mt-3 grid gap-3 sm:grid-cols-2">{lessons.map((lesson)=>{const p=status(lesson.id);return <Card key={lesson.id} className="flex items-start gap-3"><Layers3 className="mt-0.5 shrink-0 text-accent" size={20}/><div className="min-w-0 flex-1"><h3 className="font-medium">{lesson.title}</h3><p className="mt-1 text-sm text-muted">{lesson.summary}</p><p className="mt-2 text-xs text-muted">{lesson.minutes} min · {p?.completedAt ? 'Completed' : p ? 'In progress' : 'Not started'}</p><ButtonLink to={`/study/learn/${lesson.id}`} variant="secondary" className="mt-3">{p ? 'Open lesson' : 'Start'}</ButtonLink></div></Card>})}</div></section>})}
    <Card className="flex gap-3"><CircleAlert className="shrink-0 text-accent"/><p className="text-sm text-muted">Memory aids are learning tools. The facts in every lesson are shown separately so you can tell what you need to know for the test.</p></Card>
  </div>
}
