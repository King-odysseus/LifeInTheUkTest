import { useEffect, useState } from 'react'
import { Card, Meter, Spinner } from '../components/ui'
import { db, questionHistory, recentAttempts } from '../lib/db'
import { loadAll } from '../lib/questions'
import { dueCount } from '../lib/srs'
import { CHAPTERS, type Attempt, type Question } from '../lib/types'

interface ChapterStat {
  id: number
  short: string
  asked: number
  right: number
}

export default function Stats() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null)
  const [chapterStats, setChapterStats] = useState<ChapterStat[]>([])
  const [worst, setWorst] = useState<{ question: Question; asked: number; right: number }[]>([])
  const [due, setDue] = useState(0)
  const [flashcards, setFlashcards] = useState({ studied: 0, learning: 0, mastered: 0 })

  useEffect(() => {
    void (async () => {
      const [history, all, list, dueNow, schedules] = await Promise.all([
        questionHistory(),
        loadAll(),
        recentAttempts(100),
        dueCount(),
        db.srs.toArray(),
      ])
      const byId = new Map(all.map((q) => [q.id, q]))

      setChapterStats(
        CHAPTERS.map((ch) => {
          let asked = 0
          let right = 0
          for (const [id, stat] of history) {
            if (byId.get(id)?.chapter !== ch.id) continue
            asked += stat.asked
            right += stat.right
          }
          return { id: ch.id, short: ch.short, asked, right }
        }),
      )

      setWorst(
        [...history.entries()]
          .filter(([, s]) => s.right < s.asked)
          .sort((a, b) => a[1].right / a[1].asked - b[1].right / b[1].asked)
          .slice(0, 10)
          .flatMap(([id, s]) => {
            const question = byId.get(id)
            return question ? [{ question, ...s }] : []
          }),
      )

      setAttempts(list)
      setDue(dueNow)
      setFlashcards({
        studied: schedules.length,
        learning: schedules.filter((s) => s.repetitions > 0 && s.intervalDays < 7).length,
        mastered: schedules.filter((s) => s.repetitions > 0 && s.intervalDays >= 7).length,
      })
    })()
  }, [])

  if (!attempts) return <Spinner label="Working out your progress" />

  if (attempts.length === 0) {
    return (
      <Card>
        <h1 className="font-medium">No attempts yet</h1>
        <p className="mt-1 text-sm text-muted">
          Take a mock test or a practice drill and your progress will appear here.
        </p>
      </Card>
    )
  }

  const mocks = attempts.filter((a) => a.mode === 'mock')
  const passed = mocks.filter((a) => a.passed).length
  const totalAnswered = attempts.reduce((sum, a) => sum + a.total, 0)
  const studyMs = attempts.reduce((sum, a) => sum + a.durationMs, 0)
  const trendAttempts = mocks.length >= 2 ? mocks : attempts
  const improvement = improvementPoints(trendAttempts)

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Your revision</p>
        <h1 className="mt-1 text-xl font-semibold text-navy">Progress</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Mock tests" value={String(mocks.length)} />
        <Stat label="Mocks passed" value={`${passed}/${mocks.length || 0}`} />
        <Stat label="Questions answered" value={String(totalAnswered)} />
        <Stat label="Time studied" value={`${Math.round(studyMs / 60000)}m`} />
        <Stat
          label="Improvement"
          value={improvement == null ? 'Keep practising' : `${improvement > 0 ? '+' : ''}${improvement} pts`}
        />
      </div>

      {due > 0 && (
        <Card>
          <p className="text-sm">
            <span className="font-medium">{due}</span> cards are due for review.
          </p>
        </Card>
      )}

      <Card>
        <h2 className="font-medium">Flashcard progress</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-3 sm:gap-3">
          <Stat label="Cards studied" value={String(flashcards.studied)} />
          <Stat label="Learning" value={String(flashcards.learning)} />
          <Stat label="Mastered" value={String(flashcards.mastered)} />
        </div>
        <p className="mt-3 text-xs text-muted">
          A card is mastered when your review interval reaches at least seven days.
        </p>
      </Card>

      <Card>
        <h2 className="font-medium">Chapter mastery</h2>
        <ul className="mt-3 space-y-3">
          {chapterStats.map((c) => (
            <li key={c.id}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{c.short}</span>
                <span className="tabular-nums text-muted">
                  {c.asked === 0 ? 'not started' : `${Math.round((c.right / c.asked) * 100)}%`}
                </span>
              </div>
              <Meter value={c.right} max={Math.max(c.asked, 1)} />
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-medium">Recent mock tests</h2>
        {mocks.length === 0 ? (
          <p className="mt-1 text-sm text-muted">No full mock tests yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {mocks.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm sm:gap-3">
                <span className="w-16 shrink-0 text-xs text-muted sm:w-24 sm:text-sm">
                  {new Date(a.takenAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <div className="flex-1">
                  <Meter value={a.score} max={a.total} />
                </div>
                <span className={`w-14 text-right tabular-nums ${a.passed ? 'text-good' : 'text-bad'}`}>
                  {a.score}/{a.total}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {worst.length > 0 && (
        <Card>
          <h2 className="font-medium">Most missed questions</h2>
          <ul className="mt-3 space-y-3">
            {worst.map(({ question, asked, right }) => (
              <li key={question.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                <p className="text-sm">{question.question}</p>
                <p className="mt-1 text-sm text-good">
                  {question.correct.map((i) => question.options[i]).join(', ')}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Right {right} of {asked} times
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

/** Compares the older and newer halves using percentages, so test size does not skew the trend. */
function improvementPoints(attempts: Attempt[]): number | null {
  if (attempts.length < 2) return null
  const chronological = [...attempts].sort((a, b) => a.takenAt - b.takenAt)
  const split = Math.ceil(chronological.length / 2)
  const older = chronological.slice(0, split)
  const newer = chronological.slice(split)
  if (!newer.length) return null
  const average = (list: Attempt[]) =>
    list.reduce((sum, attempt) => sum + (attempt.score / Math.max(attempt.total, 1)) * 100, 0) /
    list.length
  return Math.round(average(newer) - average(older))
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  )
}
