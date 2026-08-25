import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTest } from '../store/test'
import { isCorrect } from '../lib/questions'
import { Button, Spinner } from '../components/ui'

function formatClock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function Timer({ deadline, onExpire }: { deadline: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(deadline - Date.now())
  const fired = useRef(false)

  useEffect(() => {
    const tick = () => {
      const left = deadline - Date.now()
      setRemaining(left)
      if (left <= 0 && !fired.current) {
        fired.current = true
        onExpire()
      }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [deadline, onExpire])

  const low = remaining < 5 * 60_000
  return (
    <span
      className={`font-mono text-sm tabular-nums ${low ? 'text-bad' : 'text-muted'}`}
      role="timer"
      aria-live={low ? 'polite' : 'off'}
    >
      {formatClock(remaining)}
    </span>
  )
}

export default function TestScreen() {
  const navigate = useNavigate()
  const {
    status,
    config,
    questions,
    index,
    chosen,
    flagged,
    deadline,
    select,
    next,
    prev,
    goto,
    toggleFlag,
    openReview,
    finish,
  } = useTest()

  const question = questions[index]
  const picks = question ? (chosen[question.id] ?? []) : []
  const instant = config?.instantFeedback ?? false
  const answered = picks.length === (question?.correct.length ?? 1)
  const revealed = instant && answered

  const submit = async () => {
    await finish()
    navigate('/results')
  }

  // Keyboard shortcuts: 1-4 to answer, arrows to move, Enter to advance.
  useEffect(() => {
    if (status !== 'active' || !question) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const digit = Number(e.key)
      if (digit >= 1 && digit <= question.options.length) {
        select(digit - 1)
      } else if (e.key === 'ArrowRight' || (e.key === 'Enter' && answered)) {
        index === questions.length - 1 ? openReview() : next()
      } else if (e.key === 'ArrowLeft') {
        prev()
      } else if (e.key.toLowerCase() === 'f') {
        toggleFlag()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, question, answered, index, questions.length, select, next, prev, toggleFlag, openReview])

  if (status === 'idle') {
    navigate('/')
    return null
  }
  if (status === 'loading') return <Spinner label="Preparing your questions" />

  // ------------------------------------------------------------ review screen
  if (status === 'review') {
    const unanswered = questions.filter((q) => (chosen[q.id] ?? []).length === 0)
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-semibold">Review your answers</h1>
        <p className="mt-1.5 text-sm text-muted">
          {unanswered.length === 0
            ? 'All questions answered.'
            : `${unanswered.length} question${unanswered.length === 1 ? '' : 's'} still unanswered.`}
        </p>

        <ol className="mt-5 grid grid-cols-6 gap-2 sm:grid-cols-8">
          {questions.map((q, i) => {
            const done = (chosen[q.id] ?? []).length > 0
            const flag = flagged.has(q.id)
            return (
              <li key={q.id}>
                <button
                  onClick={() => {
                    goto(i)
                    useTest.setState({ status: 'active' })
                  }}
                  className={`h-10 w-full rounded-lg border text-sm tabular-nums ${
                    flag
                      ? 'border-warn text-warn'
                      : done
                        ? 'border-brand bg-brand-soft text-brand'
                        : 'border-line text-muted'
                  }`}
                  aria-label={`Question ${i + 1}${done ? ', answered' : ', not answered'}${flag ? ', flagged' : ''}`}
                >
                  {i + 1}
                </button>
              </li>
            )
          })}
        </ol>

        <div className="mt-6 flex gap-2">
          <Button onClick={() => void submit()}>Submit test</Button>
          <Button variant="secondary" onClick={() => useTest.setState({ status: 'active' })}>
            Keep checking
          </Button>
        </div>
      </div>
    )
  }

  if (!question) return null

  const needed = question.correct.length
  const correct = isCorrect(question, picks)

  // ---------------------------------------------------------- question screen
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-4">
      <header className="flex items-center gap-3 border-b border-line pb-3">
        <button onClick={() => navigate('/')} className="text-sm text-muted hover:text-ink">
          Exit
        </button>
        <span className="ml-auto text-sm tabular-nums text-muted">
          {index + 1} of {questions.length}
        </span>
        {deadline && <Timer deadline={deadline} onExpire={() => void submit()} />}
      </header>

      <div className="h-1 w-full bg-line">
        <div
          className="h-full bg-brand transition-[width]"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 py-6" key={question.id}>
        <h1 className="animate-fade-in text-lg font-medium">{question.question}</h1>
        {needed > 1 && (
          <p className="mt-1.5 animate-fade-in text-sm text-muted">Choose {needed} answers.</p>
        )}

        <div className="mt-5 space-y-2.5" role="group">
          {question.options.map((option, i) => {
            const picked = picks.includes(i)
            const right = question.correct.includes(i)

            let tone = 'border-line hover:border-brand'
            if (revealed && right) tone = 'border-good bg-good-soft'
            else if (revealed && picked) tone = 'border-bad bg-bad-soft'
            else if (picked) tone = 'border-brand bg-brand-soft'

            return (
              <button
                key={i}
                onClick={() => !revealed && select(i)}
                disabled={revealed}
                aria-pressed={picked}
                style={{ animationDelay: `${i * 50}ms` }}
                className={`flex w-full animate-fade-up items-start gap-3 rounded-xl border bg-surface px-4 py-3 text-left transition ${tone}`}
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line text-xs text-muted">
                  {i + 1}
                </span>
                <span className="text-sm">{option}</span>
              </button>
            )
          })}
        </div>

        {revealed && (
          <div
            className={`mt-4 rounded-xl p-4 text-sm ${
              correct ? 'animate-pop bg-good-soft text-good' : 'animate-shake bg-bad-soft text-bad'
            }`}
          >
            <p className="font-medium">{correct ? 'Correct' : 'Not quite'}</p>
            <p className="mt-1 text-ink/80">{question.explanation}</p>
          </div>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-line pt-3">
        <Button variant="ghost" onClick={prev} disabled={index === 0}>
          Back
        </Button>
        <button
          onClick={toggleFlag}
          className={`rounded-lg px-2.5 py-1.5 text-sm ${
            flagged.has(question.id) ? 'text-warn' : 'text-muted hover:text-ink'
          }`}
        >
          {flagged.has(question.id) ? 'Flagged' : 'Flag'}
        </button>

        <div className="ml-auto">
          {index === questions.length - 1 ? (
            <Button onClick={openReview}>Review answers</Button>
          ) : (
            <Button onClick={next}>Next</Button>
          )}
        </div>
      </footer>
    </div>
  )
}
