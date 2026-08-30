import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Check, Clock3, X } from 'lucide-react'
import { useTest } from '../store/test'
import { isCorrect } from '../lib/questions'
import { Alert, Button, Spinner } from '../components/ui'

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
    <div
      className={`flex min-w-24 items-center justify-center gap-2 rounded-2xl border px-3 py-2 sm:min-w-40 sm:justify-start sm:px-5 sm:py-3 ${
        low ? 'border-bad/30 bg-bad-soft text-bad' : 'border-line bg-surface text-ink'
      }`}
      role="timer"
      aria-live={low ? 'polite' : 'off'}
    >
      <Clock3 className="shrink-0" size={20} />
      <span>
        <span className="hidden text-[0.6875rem] font-semibold tracking-wide text-muted uppercase sm:block">
          Time remaining
        </span>
        <span className="block font-mono text-lg leading-none font-semibold tabular-nums sm:mt-1 sm:text-2xl">
          {formatClock(remaining)}
        </span>
      </span>
    </div>
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
    backToActive,
    finish,
    reset,
  } = useTest()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const submittingRef = useRef(false)

  const question = questions[index]
  const picks = question ? (chosen[question.id] ?? []) : []
  const instant = config?.instantFeedback ?? false
  const autoAdvanceDelay = instant ? 15_000 : 350
  const answered = picks.length === (question?.correct.length ?? 1)
  const revealed = instant && answered

  const submit = useCallback(async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      await finish()
      navigate('/results')
    } catch {
      submittingRef.current = false
      setSubmitting(false)
      setSubmitError('Could not save your result. Your answers are still here — please try again.')
    }
  }, [finish, navigate])

  const exitTest = () => {
    const hasAnswers = Object.values(chosen).some((answers) => answers.length > 0)
    if (hasAnswers && !window.confirm('Leave this test? Your answers from this attempt will be lost.')) return
    reset()
    navigate('/')
  }

  // Keyboard shortcuts: 1-4 to answer, arrows to move, Enter to advance.
  useEffect(() => {
    if (status !== 'active' || !question) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target
      if (
        target instanceof HTMLElement &&
        target.closest('button, input, select, textarea, a, [contenteditable="true"]')
      ) return
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

  // Move on once the required answer(s) are selected. Practice modes pause
  // briefly for feedback; exam-style modes advance quickly without revealing it.
  useEffect(() => {
    if (status !== 'active' || !answered) return
    const id = window.setTimeout(() => {
      if (index !== questions.length - 1) return next()
      if (instant) void submit()
      else openReview()
    }, autoAdvanceDelay)
    return () => window.clearTimeout(id)
  }, [status, instant, answered, index, questions.length, next, openReview, autoAdvanceDelay, submit])

  if (status === 'idle') {
    return <Navigate to="/" replace />
  }
  if (status === 'loading') return <Spinner label="Preparing your questions" />

  // ------------------------------------------------------------ review screen
  if (status === 'review') {
    const unanswered = questions.filter((q) => (chosen[q.id] ?? []).length === 0)
    return (
      <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <h1 className="text-2xl font-semibold text-navy">Review your answers</h1>
        <p className="mt-1.5 text-sm text-muted">
          {unanswered.length === 0
            ? 'All questions answered.'
            : `${unanswered.length} question${unanswered.length === 1 ? '' : 's'} still unanswered.`}
        </p>

        <ol className="mt-6 grid grid-cols-5 gap-3 sm:grid-cols-8 lg:grid-cols-12 xl:grid-cols-16">
          {questions.map((q, i) => {
            const done = (chosen[q.id] ?? []).length > 0
            const flag = flagged.has(q.id)
            return (
              <li key={q.id}>
                <button
                  onClick={() => {
                    goto(i)
                    backToActive()
                  }}
                  className={`h-12 w-full rounded-xl border text-sm font-medium tabular-nums transition hover:-translate-y-0.5 ${
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

        <div className="mt-8 grid gap-2 sm:flex">
          <Button className="w-full sm:w-auto" disabled={submitting} onClick={() => void submit()}>
            {submitting ? 'Saving result…' : 'Submit test'}
          </Button>
          <Button
            className="w-full sm:w-auto"
            variant="secondary"
            disabled={submitting}
            onClick={backToActive}
          >
            Keep checking
          </Button>
        </div>
        {submitError && <div className="mt-4 max-w-xl"><Alert>{submitError}</Alert></div>}
      </div>
    )
  }

  if (!question) return null

  const needed = question.correct.length
  const correct = isCorrect(question, picks)

  // ---------------------------------------------------------- question screen
  return (
    <div className="flex min-h-dvh w-full flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-10">
      <header className="flex min-h-18 items-center gap-3 border-b border-line py-3 sm:min-h-24 sm:py-4">
        <button
          onClick={exitTest}
          className="rounded-full px-3 py-2.5 text-base font-semibold text-muted transition hover:bg-surface hover:text-ink sm:px-5 sm:text-lg"
        >
          Exit
        </button>
        <div className="ml-auto flex items-center gap-5 sm:gap-10 lg:gap-14">
          <div className="text-right">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase sm:text-sm">Question</p>
            <p className="mt-0.5 text-lg leading-none font-semibold tabular-nums sm:mt-1 sm:text-2xl">
              {index + 1} <span className="text-muted">of {questions.length}</span>
            </p>
          </div>
          {deadline && <Timer deadline={deadline} onExpire={submit} />}
        </div>
      </header>

      <div className="h-2 w-full overflow-hidden rounded-full bg-line sm:h-2.5">
        <div
          className="h-full bg-brand transition-[width]"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      <main className="flex-1 py-7 sm:py-9 lg:py-10" key={question.id}>
        <section className="rounded-3xl border border-line bg-surface px-5 py-7 shadow-card sm:px-8 sm:py-9 lg:px-10 lg:py-12">
        <p className="text-sm font-bold tracking-[0.12em] text-accent uppercase sm:text-base">Choose your answer</p>
        <h1 className="mt-3 animate-fade-in text-xl leading-snug font-semibold text-navy sm:text-2xl">
          {question.question}
        </h1>
        {needed > 1 && (
          <p className="mt-3 animate-fade-in text-sm text-muted">Select {needed} answers.</p>
        )}

        <div className="mt-7 grid gap-3 sm:mt-8 sm:gap-4" role="group">
          {question.options.map((option, i) => {
            const picked = picks.includes(i)
            const right = question.correct.includes(i)

            let tone = 'border-line hover:border-brand hover:bg-brand-soft/30 hover:shadow-card-hover'
            if (revealed && right)
              tone = 'border-good bg-good-soft shadow-card ring-2 ring-good/30 ring-offset-2 ring-offset-canvas'
            else if (revealed && picked)
              tone = 'border-bad bg-bad-soft shadow-card ring-2 ring-bad/30 ring-offset-2 ring-offset-canvas'
            else if (picked)
              tone = 'border-brand bg-brand-soft shadow-elevated ring-2 ring-brand/40 ring-offset-2 ring-offset-canvas'

            const status = revealed && right ? 'Correct' : revealed && picked ? 'Your answer' : picked ? 'Selected' : null
            const markerTone =
              revealed && right
                ? 'border-good bg-good text-white'
                : revealed && picked
                  ? 'border-bad bg-bad text-white'
                  : picked
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-surface-secondary text-muted'

            return (
              <button
                key={i}
                onClick={() => !revealed && select(i)}
                disabled={revealed}
                aria-pressed={picked}
                style={{ animationDelay: `${i * 50}ms` }}
                className={`grid min-h-16 w-full animate-fade-up grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border bg-surface px-4 py-3 text-left transition sm:min-h-20 sm:gap-4 sm:px-5 ${tone}`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold sm:h-11 sm:w-11 ${markerTone}`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-base leading-relaxed sm:text-lg">{option}</span>
                {status && (
                  <span
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold whitespace-nowrap sm:px-3 sm:text-xs ${
                      revealed && right
                        ? 'bg-good text-white'
                        : revealed && picked
                          ? 'bg-bad text-white'
                          : 'bg-brand text-white'
                    }`}
                  >
                    {revealed && picked && !right ? <X size={14} /> : <Check size={14} />}
                    <span className="hidden min-[380px]:inline">{status}</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {revealed && (
          <div
            className={`mt-6 rounded-2xl p-5 text-base sm:p-6 sm:text-lg ${
              correct ? 'animate-pop bg-good-soft text-good' : 'animate-shake bg-bad-soft text-bad'
            }`}
          >
            <p className="text-lg font-semibold sm:text-xl">{correct ? 'Correct' : 'Not quite'}</p>
            <p className="mt-2 leading-relaxed text-ink/80">{question.explanation}</p>
          </div>
        )}
        </section>
      </main>

      <footer className="flex items-center gap-2 border-t border-line bg-canvas py-4 sm:gap-3">
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
            <Button className="px-5 sm:px-7" onClick={openReview}>Review answers</Button>
          ) : (
            <Button className="px-6 sm:px-8" onClick={next}>Next</Button>
          )}
        </div>
      </footer>
      {submitError && <div className="pb-3"><Alert>{submitError}</Alert></div>}
    </div>
  )
}
