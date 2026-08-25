import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Play, RefreshCw, Target, Trash2, UserPlus, Zap } from 'lucide-react'
import { Button, ButtonLink, Card, Meter } from '../components/ui'
import { useTest } from '../store/test'
import { useAuth } from '../store/auth'
import { customTestPresets, deleteCustomTestPreset, recentAttempts, touchCustomTestPreset } from '../lib/db'
import { dueCount } from '../lib/srs'
import { EXAM, type Attempt, type CustomTestPreset } from '../lib/types'

/**
 * A single readiness number is more motivating than a wall of statistics.
 * Recent mock attempts are weighted more heavily than old ones.
 */
function readiness(attempts: Attempt[]): number | null {
  const mocks = attempts.filter((a) => a.mode === 'mock').slice(0, 5)
  if (mocks.length === 0) return null
  let weighted = 0
  let weight = 0
  mocks.forEach((a, i) => {
    const w = 1 / (i + 1)
    weighted += (a.score / a.total) * w
    weight += w
  })
  return Math.round((weighted / weight) * 100)
}

export default function Home() {
  const navigate = useNavigate()
  const start = useTest((s) => s.start)
  const { user, accountsEnabled } = useAuth()
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [due, setDue] = useState(0)
  const [recentTests, setRecentTests] = useState<CustomTestPreset[]>([])
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    void recentAttempts(20).then(setAttempts)
    void dueCount().then(setDue)
    void customTestPresets().then(setRecentTests)
  }, [])

  const score = readiness(attempts)
  const lastMock = attempts.find((a) => a.mode === 'mock')

  const begin = async (mode: 'mock' | 'rapid' | 'weak') => {
    setStarting(true)
    await start({ mode, instantFeedback: mode !== 'mock' })
    navigate('/test')
  }

  const beginPreset = async (preset: CustomTestPreset) => {
    setStarting(true)
    const updated = await touchCustomTestPreset(preset)
    await start({
      mode: updated.rapid ? 'rapid' : 'custom',
      chapters: updated.chapters.length ? updated.chapters : undefined,
      difficulty: updated.difficulty.length ? updated.difficulty : undefined,
      count: updated.count,
      timed: updated.rapid ? false : updated.timed,
      instantFeedback: updated.rapid || !updated.timed,
      focusWeak: updated.focusWeak,
    })
    navigate('/test')
  }

  const removePreset = async (id: string) => {
    await deleteCustomTestPreset(id)
    setRecentTests((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-5">
      <section className="card px-5 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
        <p className="eyebrow">Mock exam & revision</p>
        <h1 className="mt-1 text-xl font-semibold text-navy">Practice for the Life in the UK test</h1>
        <p className="mt-1.5 text-sm text-muted">
          {EXAM.questionCount} questions in {EXAM.durationMs / 60000} minutes. You need{' '}
          {EXAM.passMark} correct to pass.
        </p>

        {score !== null && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-sm text-muted">Readiness</span>
              <span className="text-2xl font-semibold tabular-nums">{score}%</span>
            </div>
            <Meter value={score} />
            <p className="mt-1.5 text-xs text-muted">
              {score >= 85
                ? 'You are consistently passing. Book the test.'
                : score >= 75
                  ? 'On track. Keep drilling your weak areas.'
                  : 'Below the pass mark. Work through the chapters you are missing.'}
            </p>
          </div>
        )}

        <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
          <Button className="w-full sm:w-auto" variant="gold" onClick={() => void begin('mock')} disabled={starting}>
            <Play size={16} />
            Start full mock test
          </Button>
          <Button className="w-full sm:w-auto" variant="secondary" onClick={() => void begin('rapid')} disabled={starting}>
            <Zap size={16} />
            Quick 10
          </Button>
          {attempts.length > 0 && (
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => void begin('weak')} disabled={starting}>
              <Target size={16} />
              Practise weak areas
            </Button>
          )}
        </div>
      </section>

      {recentTests.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="eyebrow">Saved by you</p>
              <h2 className="mt-1 text-xl font-semibold text-navy">Recent tests</h2>
            </div>
            <ButtonLink to="/practice" variant="ghost">
              Build another
            </ButtonLink>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {recentTests.map((preset) => (
              <Card key={preset.id} className="flex flex-col">
                <div className="flex items-start gap-2">
                  {preset.rapid ? (
                    <Zap size={19} className="mt-0.5 shrink-0 text-accent" />
                  ) : (
                    <Play size={19} className="mt-0.5 shrink-0 text-accent" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{preset.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {preset.count} questions · {preset.rapid ? 'Rapid' : preset.timed ? 'Timed' : 'Normal'}
                      {preset.focusWeak ? ' · Weak areas first' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => void removePreset(preset.id)}
                    className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-bad-soft hover:text-bad"
                    aria-label={`Delete ${preset.name}`}
                    title={`Delete ${preset.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  disabled={starting}
                  onClick={() => void beginPreset(preset)}
                >
                  Start again
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {due > 0 && (
          <Card>
            <h2 className="font-medium">{due} questions due for review</h2>
            <p className="mt-1 text-sm text-muted">
              Spaced repetition brings back the facts you are most likely to forget.
            </p>
            <ButtonLink to="/study" variant="secondary" className="mt-3">
              <RefreshCw size={16} />
              Review now
            </ButtonLink>
          </Card>
        )}

        {lastMock && (
          <Card>
            <h2 className="font-medium">Last mock test</h2>
            <p className="mt-1 text-sm text-muted">
              {lastMock.score}/{lastMock.total} —{' '}
              <span className={lastMock.passed ? 'text-good' : 'text-bad'}>
                {lastMock.passed ? 'Pass' : 'Fail'}
              </span>
            </p>
            <ButtonLink to="/stats" variant="secondary" className="mt-3">
              <BarChart3 size={16} />
              See progress
            </ButtonLink>
          </Card>
        )}

        {accountsEnabled && !user && attempts.length > 0 && (
          <Card>
            <h2 className="font-medium">Keep your progress</h2>
            <p className="mt-1 text-sm text-muted">
              Your history is saved on this device. Create an account to sync it across your phone
              and computer — it takes an email and a password.
            </p>
            <ButtonLink to="/signup" variant="secondary" className="mt-3">
              <UserPlus size={16} />
              Create account
            </ButtonLink>
          </Card>
        )}
      </div>
    </div>
  )
}
