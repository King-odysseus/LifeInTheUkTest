import { useCallback, useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { Button, Card, Spinner } from '../components/ui'
import { db } from '../lib/db'
import { dueQuestionIds } from '../lib/srs'
import { schedule } from '../lib/srs'
import { findQuestions, sampleQuestions } from '../lib/questions'
import { CHAPTERS, type Question } from '../lib/types'
import { useAuth } from '../store/auth'

/**
 * Flashcard review driven by SM-2. Grading is manual here rather than inferred
 * from a multiple-choice answer, because recall without options is the point.
 */
export default function Study() {
  const [cards, setCards] = useState<Question[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)

  const load = useCallback(async () => {
    const due = await dueQuestionIds(40)
    // Nothing scheduled yet, so seed the session with a spread of new material.
    const questions = due.length ? await findQuestions(due) : await sampleQuestions({ count: 20 })
    setCards(questions)
    setIndex(0)
    setRevealed(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!cards) return <Spinner label="Loading your review" />

  const card = cards[index]

  if (!card) {
    return (
      <Card className="text-center">
        <h1 className="font-medium">Review complete</h1>
        <p className="mt-1 text-sm text-muted">
          {reviewed} card{reviewed === 1 ? '' : 's'} reviewed. Come back when more fall due.
        </p>
        <Button className="mt-4" onClick={() => void load()}>
          Study more
        </Button>
      </Card>
    )
  }

  const grade = async (value: number) => {
    const prev = await db.srs.get(card.id)
    await db.srs.put(schedule(prev, card.id, value))
    // Persist the new interval for signed-in users. Guest users keep the same
    // local-first behaviour and their cards are adopted when they register.
    void useAuth.getState().syncUp()
    setReviewed((n) => n + 1)
    setRevealed(false)
    setIndex((i) => i + 1)
  }

  const chapter = CHAPTERS.find((c) => c.id === card.chapter)

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Flashcards</p>
        <div className="mt-1 flex items-baseline justify-between">
          <h1 className="text-xl font-semibold text-navy">Study</h1>
          <span className="text-sm tabular-nums text-muted">
            {index + 1} of {cards.length}
          </span>
        </div>
      </div>

      <div key={card.id} className="animate-fade-up [perspective:1200px]">
        <div
          className="grid transition-transform duration-500 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front — the question. */}
          <div className="[grid-area:1/1] [backface-visibility:hidden]">
            <Card className="flex min-h-72 flex-col">
              <p className="text-xs text-muted">
                {chapter?.short} · {card.section}
              </p>
              <p className="mt-3 flex-1 text-lg font-medium">{card.question}</p>
              <Button
                className="mt-5 self-start"
                variant="secondary"
                onClick={() => setRevealed(true)}
              >
                <RotateCw size={16} />
                Show answer
              </Button>
            </Card>
          </div>

          {/* Back — the answer + recall grade. */}
          <div className="[grid-area:1/1] [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <Card className="flex min-h-72 flex-col">
              <p className="text-xs text-muted">
                {chapter?.short} · {card.section}
              </p>
              <p className="mt-3 font-medium text-good">
                {card.correct.map((i) => card.options[i]).join(', ')}
              </p>
              <p className="mt-2 flex-1 text-sm text-muted">{card.explanation}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {/* Grades map onto SM-2: below 3 is a lapse, 5 is effortless recall. */}
                <Button variant="secondary" className="flex-1" onClick={() => void grade(0)}>
                  Again
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => void grade(3)}>
                  Hard
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => void grade(4)}>
                  Good
                </Button>
                <Button className="flex-1" onClick={() => void grade(5)}>
                  Easy
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
