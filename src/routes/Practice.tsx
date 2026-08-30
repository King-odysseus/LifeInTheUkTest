import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Infinity as InfinityIcon, Play, Target, Zap } from 'lucide-react'
import { Button, Card, Field } from '../components/ui'
import { useTest } from '../store/test'
import { saveCustomTestPreset } from '../lib/db'
import { newId } from '../lib/id'
import { CHAPTERS, type ChapterId, type CustomTestPreset, type Difficulty } from '../lib/types'

export default function Practice() {
  const navigate = useNavigate()
  const start = useTest((s) => s.start)

  const [chapters, setChapters] = useState<ChapterId[]>([])
  const [count, setCount] = useState(20)
  const [timed, setTimed] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty | 0>(0)
  const [name, setName] = useState('')
  const [rapid, setRapid] = useState(false)
  const [focusWeak, setFocusWeak] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id: ChapterId) =>
    setChapters((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))

  const begin = async (config: Parameters<typeof start>[0]) => {
    setBusy(true)
    setError('')
    try {
      await start(config)
      navigate('/test')
    } catch {
      setError('Could not prepare the test. Check that browser storage is available and try again.')
      setBusy(false)
    }
  }

  const buildAndBegin = async () => {
    const now = Date.now()
    const preset: CustomTestPreset = {
      id: newId(),
      name: name.trim(),
      chapters,
      count,
      difficulty: difficulty ? [difficulty] : [],
      timed: rapid ? false : timed,
      rapid,
      focusWeak,
      createdAt: now,
      lastUsedAt: now,
    }
    setBusy(true)
    setError('')
    try {
      // Saving first means the test is on the home screen even if the user
      // abandons this run part way through.
      await saveCustomTestPreset(preset)
      await start({
        mode: rapid ? 'rapid' : 'custom',
        chapters: chapters.length ? chapters : undefined,
        difficulty: difficulty ? [difficulty] : undefined,
        count,
        timed: rapid ? false : timed,
        instantFeedback: rapid || !timed,
        focusWeak,
      })
      navigate('/test')
    } catch (err) {
      // Previously this threw into a floating promise: the button stayed
      // disabled, nothing was saved, and nothing said why.
      console.error('[practice] could not save or start the custom test', err)
      setError('Could not save this test. Your browser may be blocking local storage.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <p className="eyebrow">Drills & tests</p>
        <h1 className="mt-1 text-xl font-semibold text-navy">Practice</h1>
        <p className="mt-1 text-sm text-muted">
          Practice modes show the answer and explanation as you go. Only the mock test hides them.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-medium">By chapter</h2>
          <p className="mt-1 text-sm text-muted">Untimed drill on one part of the handbook.</p>
          <ul className="mt-3 space-y-2">
            {CHAPTERS.map((ch) => (
              <li key={ch.id}>
                <button
                  onClick={() =>
                    void begin({ mode: 'chapter', chapters: [ch.id], instantFeedback: true })
                  }
                  disabled={busy}
                  className="w-full rounded-lg border border-line px-3 py-2.5 text-left text-sm hover:border-brand"
                >
                  <span className="font-medium">{ch.short}</span>
                  <span className="block text-xs text-muted">{ch.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-medium">Build your own test</h2>

          <div className="mt-3">
            <Field
              label="Test name"
              placeholder="e.g. History rapid revision"
              required
              maxLength={50}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <fieldset className="mt-4">
            <legend className="text-sm text-muted">Style</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRapid(false)}
                aria-pressed={!rapid}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${
                  !rapid ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => {
                  setRapid(true)
                  setTimed(false)
                }}
                aria-pressed={rapid}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${
                  rapid ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted'
                }`}
              >
                Rapid
              </button>
            </div>
          </fieldset>

          <fieldset className="mt-3">
            <legend className="text-sm text-muted">Chapters (all if none selected)</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CHAPTERS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => toggle(ch.id)}
                  aria-pressed={chapters.includes(ch.id)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                    chapters.includes(ch.id)
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-line text-muted'
                  }`}
                >
                  {ch.short}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 block text-sm">
            <span className="text-muted">Questions: {count}</span>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-1.5 w-full accent-brand"
            />
          </label>

          <fieldset className="mt-3">
            <legend className="text-sm text-muted">Difficulty</legend>
            <div className="mt-2 flex gap-1.5">
              {[
                { value: 0, label: 'Any' },
                { value: 1, label: 'Easy' },
                { value: 2, label: 'Medium' },
                { value: 3, label: 'Hard' },
              ].map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDifficulty(d.value as Difficulty | 0)}
                  aria-pressed={difficulty === d.value}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                    difficulty === d.value
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-line text-muted'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={timed}
              disabled={rapid}
              onChange={(e) => setTimed(e.target.checked)}
            />
            <span>Timed (45 minutes)</span>
          </label>

          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              className="mt-0.5"
              type="checkbox"
              checked={focusWeak}
              onChange={(event) => setFocusWeak(event.target.checked)}
            />
            <span>
              Focus on weak areas
              <span className="block text-xs text-muted">
                Prioritise questions you previously answered incorrectly.
              </span>
            </span>
          </label>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-bad-soft px-3 py-2.5 text-sm text-bad">
              {error}
            </p>
          )}

          <Button
            className="mt-4 w-full"
            disabled={busy || !name.trim()}
            onClick={() => void buildAndBegin()}
          >
            Save &amp; start
          </Button>
        </Card>

        <Card>
          <h2 className="font-medium">Quick modes</h2>
          <div className="mt-3 space-y-2">
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={() => void begin({ mode: 'rapid', instantFeedback: true })}
            >
              <Zap size={16} />
              Rapid fire — 10 questions
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={() => void begin({ mode: 'weak', instantFeedback: true })}
            >
              <Target size={16} />
              Weak areas — what you keep missing
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={() => void begin({ mode: 'endless', instantFeedback: true })}
            >
              <InfinityIcon size={16} />
              Endless — keep going until you stop
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="font-medium">Full mock test</h2>
          <p className="mt-1 text-sm text-muted">
            24 questions, 45 minutes, no feedback until you submit. Exactly like the real thing.
          </p>
          <Button
            className="mt-3 w-full"
            disabled={busy}
            onClick={() => void begin({ mode: 'mock' })}
          >
            <Play size={16} />
            Start mock test
          </Button>
        </Card>
      </div>
    </div>
  )
}
