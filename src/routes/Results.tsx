import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTest } from '../store/test'
import { Alert, Button, Card, Meter } from '../components/ui'
import { CHAPTERS, EXAM, type ChapterId } from '../lib/types'

export default function Results() {
  const navigate = useNavigate()
  const { result, config, questions, reset, start } = useTest()
  const animatedScore = useCountUp(result?.score ?? 0)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  if (!result) {
    return <Navigate to="/" replace />
  }

  const byId = new Map(questions.map((q) => [q.id, q]))
  const percent = Math.round((result.score / result.total) * 100)
  const minutes = Math.floor(result.durationMs / 60000)
  const seconds = Math.floor((result.durationMs % 60000) / 1000)

  // Per-chapter breakdown tells the user what to revise, which the raw score does not.
  const perChapter = CHAPTERS.map((ch) => {
    const answers = result.answers.filter((a) => byId.get(a.questionId)?.chapter === ch.id)
    return {
      ...ch,
      asked: answers.length,
      right: answers.filter((a) => a.correct).length,
    }
  }).filter((c) => c.asked > 0)

  const wrong = result.answers.filter((a) => !a.correct)

  const again = async () => {
    const nextConfig = config ?? { mode: result.mode, instantFeedback: result.mode !== 'mock' }
    setStarting(true)
    setError('')
    try {
      await start(nextConfig)
      navigate('/test')
    } catch {
      setStarting(false)
      setError('Could not prepare another test. Please try again.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-up px-4 py-8">
      <Card className="animate-scale-in text-center">
        <p className="text-sm text-muted">
          {result.mode === 'mock' ? 'Mock test result' : 'Practice result'}
        </p>
        <p
          className={`mt-2 text-4xl font-semibold tabular-nums ${
            result.passed ? 'text-good' : 'text-bad'
          }`}
        >
          {animatedScore}/{result.total}
        </p>
        <p className="mt-1 font-medium">
          {result.passed ? 'Pass' : 'Fail'} — {percent}%
        </p>
        {result.mode === 'mock' && (
          <p className="mt-1 text-sm text-muted">
            You need {EXAM.passMark} of {EXAM.questionCount} to pass. Time taken {minutes}m {seconds}
            s.
          </p>
        )}

        <div className="mt-5 flex justify-center gap-2">
          <Button disabled={starting} onClick={() => void again()}>
            {starting ? 'Preparing…' : 'Try another'}
          </Button>
          <Button
            variant="secondary"
            disabled={starting}
            onClick={() => {
              reset()
              navigate('/')
            }}
          >
            Done
          </Button>
        </div>
        {error && <div className="mt-4 text-left"><Alert>{error}</Alert></div>}
      </Card>

      {perChapter.length > 1 && (
        <Card className="mt-4">
          <h2 className="font-medium">By chapter</h2>
          <ul className="mt-3 space-y-3">
            {perChapter.map((c) => (
              <li key={c.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{c.short}</span>
                  <span className="tabular-nums text-muted">
                    {c.right}/{c.asked}
                  </span>
                </div>
                <Meter value={c.right} max={c.asked} label={`${c.short} score`} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {wrong.length === 0 ? (
        <Card className="mt-4 text-center">
          <h2 className="font-medium text-good">Every answer correct</h2>
          <p className="mt-1 text-sm text-muted">Excellent work — there is nothing to review this time.</p>
        </Card>
      ) : (
        <>
          <h2 className="mt-6 mb-3 font-medium">Review {wrong.length} you missed</h2>
          <ul className="space-y-3">
            {wrong.map((answer) => {
              const question = byId.get(answer.questionId)
              if (!question) return null
              return (
                <li key={answer.questionId} className="card px-5 py-6 sm:px-6 sm:py-7">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-xs font-medium text-bad">✗</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{question.question}</p>

                      <p className="mt-1.5 text-sm text-bad">
                        You chose:{' '}
                        {answer.chosen.length
                          ? answer.chosen.map((i) => question.options[i]).join(', ')
                          : 'nothing'}
                      </p>
                      <p className="mt-1 text-sm text-good">
                        Correct: {question.correct.map((i) => question.options[i]).join(', ')}
                      </p>
                      <p className="mt-2 text-sm text-muted">{question.explanation}</p>
                      <p className="mt-2 text-xs text-muted">
                        {chapterShort(question.chapter)} · {question.section}
                      </p>
                      <Link className="mt-3 inline-block text-sm font-medium text-brand hover:underline" to={`/study/question/${question.id}`}>Help me understand and remember this</Link>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

/** Eases a number from 0 up to `target` on mount, for a satisfying score reveal. */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

const chapterShort = (id: ChapterId) => CHAPTERS.find((c) => c.id === id)?.short ?? ''
