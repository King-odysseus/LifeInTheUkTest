import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RotateCcw } from 'lucide-react'
import { Button, Card, Spinner } from '../components/ui'
import { allAttempts, mistakeOverrides, setMistakeOverride } from '../lib/db'
import { chapterTitle, loadAll } from '../lib/questions'
import { deriveMistakes, type Mistake } from '../lib/mistakes'

type Filter = 'open' | 'reviewed' | 'all'

export default function Mistakes() {
  const [mistakes, setMistakes] = useState<Mistake[] | null>(null)
  const [filter, setFilter] = useState<Filter>('open')

  const load = async () => {
    const [attempts, questions, overrides] = await Promise.all([
      allAttempts(),
      loadAll(),
      mistakeOverrides(),
    ])
    const questionsById = new Map(questions.map((q) => [q.id, q]))
    setMistakes(deriveMistakes(attempts, questionsById, overrides))
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    if (!mistakes) return []
    if (filter === 'all') return mistakes
    return mistakes.filter((m) => m.status === filter)
  }, [mistakes, filter])

  const counts = useMemo(() => {
    if (!mistakes) return { open: 0, reviewed: 0, all: 0 }
    return {
      open: mistakes.filter((m) => m.status === 'open').length,
      reviewed: mistakes.filter((m) => m.status === 'reviewed').length,
      all: mistakes.length,
    }
  }, [mistakes])

  const setStatus = async (questionId: string, next: 'reviewed' | 'reopened') => {
    // Optimistic update so the list responds immediately.
    setMistakes((current) =>
      current
        ? current.map((m) =>
            m.questionId === questionId ? { ...m, status: next === 'reviewed' ? 'reviewed' : 'open' } : m,
          )
        : current,
    )
    await setMistakeOverride(questionId, next)
  }

  if (!mistakes) return <Spinner label="Loading your mistake bank" />

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Turn errors into review</p>
        <h1 className="mt-1 text-xl font-semibold text-navy">Mistake Bank</h1>
        <p className="mt-1.5 text-sm text-muted">
          Repeated misses on the same question merge into one entry. Answering it correctly later
          resolves it automatically — or manage it yourself below.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter mistakes">
        {(['open', 'reviewed', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`flex min-h-11 items-center rounded-full border px-4 text-sm font-medium capitalize transition ${
              filter === f
                ? 'border-brand bg-brand-soft text-brand'
                : 'border-line text-muted hover:text-ink'
            }`}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="text-center">
          <CheckCircle2 className="mx-auto text-good" size={30} aria-hidden="true" />
          <h2 className="mt-2 font-medium">Nothing in this view</h2>
          <p className="mt-1 text-sm text-muted">
            {filter === 'open'
              ? 'No open mistakes right now. Keep practising to build your review queue.'
              : 'Nothing here yet.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((m) => (
            <Card key={m.questionId}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold tracking-wider text-accent uppercase">
                    {chapterTitle(m.chapter)} · {m.section}
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-navy">{m.question}</h2>
                </div>
                <span className="shrink-0 rounded-full bg-bad-soft px-3 py-1 text-xs font-bold whitespace-nowrap text-bad">
                  Missed {m.occurrences}×
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-bad-soft p-3">
                  <dt className="font-semibold text-bad">Your latest answer</dt>
                  <dd className="mt-1 text-ink">
                    {m.latestChosen.length
                      ? m.latestChosen.map((i) => m.options[i]).join(', ')
                      : 'No answer recorded'}
                  </dd>
                </div>
                <div className="rounded-xl bg-good-soft p-3">
                  <dt className="font-semibold text-good">Correct answer</dt>
                  <dd className="mt-1 text-ink">{m.correct.map((i) => m.options[i]).join(', ')}</dd>
                </div>
              </dl>

              <p className="mt-3 text-sm leading-relaxed text-muted">{m.explanation}</p>

              <div className="mt-4">
                {m.status === 'open' ? (
                  <Button variant="secondary" onClick={() => void setStatus(m.questionId, 'reviewed')}>
                    <CheckCircle2 size={17} />
                    Mark reviewed
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => void setStatus(m.questionId, 'reopened')}>
                    <RotateCcw size={17} />
                    Reopen
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
