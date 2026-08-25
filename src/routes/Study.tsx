import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'
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
  const [slideDirection, setSlideDirection] = useState<'idle' | 'next' | 'previous'>('idle')
  const swipeStartX = useRef<number | null>(null)
  const swipeStartY = useRef<number | null>(null)

  const load = useCallback(async () => {
    const due = await dueQuestionIds(40)
    // Nothing scheduled yet, so seed the session with a spread of new material.
    const questions = due.length ? await findQuestions(due) : await sampleQuestions({ count: 20 })
    setCards(questions)
    setIndex(0)
    setRevealed(false)
    setReviewed(0)
    setSlideDirection('idle')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!cards) return <Spinner label="Loading your review" />

  const move = (direction: 'next' | 'previous') => {
    const nextIndex = direction === 'next' ? Math.min(index + 1, cards.length - 1) : Math.max(index - 1, 0)
    if (nextIndex === index) return
    setSlideDirection(direction)
    setRevealed(false)
    setIndex(nextIndex)
  }

  const startSwipe = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    swipeStartX.current = event.clientX
    swipeStartY.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const finishSwipe = (event: PointerEvent<HTMLDivElement>) => {
    if (swipeStartX.current == null || swipeStartY.current == null) return
    const distanceX = event.clientX - swipeStartX.current
    const distanceY = event.clientY - swipeStartY.current
    swipeStartX.current = null
    swipeStartY.current = null
    // A tap (no real movement) flips the card to reveal the answer.
    if (Math.abs(distanceX) < 60 && Math.abs(distanceY) < 60) {
      setRevealed((revealed) => !revealed)
      return
    }
    // Only a horizontal drag navigates; vertical movement is page scrolling.
    if (Math.abs(distanceX) < Math.abs(distanceY)) return
    move(distanceX > 0 ? 'next' : 'previous')
  }

  const card = cards[index]

  if (!card) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card className="text-center">
          <h1 className="font-medium">Review complete</h1>
          <p className="mt-1 text-sm text-muted">
            {reviewed} card{reviewed === 1 ? '' : 's'} reviewed. Come back when more fall due.
          </p>
          <Button className="mt-4" onClick={() => void load()}>
            Study more
          </Button>
        </Card>
      </div>
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
    setSlideDirection('next')
    setIndex((i) => i + 1)
  }

  const chapter = CHAPTERS.find((c) => c.id === card.chapter)

  return (
    <div className="w-full space-y-5 overflow-x-clip">
      <div className="mx-auto w-full max-w-3xl">
        <p className="eyebrow">Spaced repetition</p>
        <div className="mt-1 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-navy sm:text-3xl">Flashcards</h1>
          <span className="text-sm tabular-nums text-muted">
            {index + 1} of {cards.length}
          </span>
        </div>
      </div>

      <div
        key={card.id}
        className={`mx-auto w-full max-w-3xl ${
          slideDirection === 'next'
            ? 'animate-slide-next'
            : slideDirection === 'previous'
              ? 'animate-slide-previous'
              : 'animate-fade-up'
        } cursor-grab touch-pan-y select-none [perspective:1200px] active:cursor-grabbing`}
        onPointerDown={startSwipe}
        onPointerUp={finishSwipe}
        onPointerCancel={() => {
          swipeStartX.current = null
          swipeStartY.current = null
        }}
      >
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

      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
        <Button
          variant="secondary"
          className="w-28 shrink-0 sm:w-36"
          disabled={index === 0}
          onClick={() => move('previous')}
        >
          <ChevronLeft size={18} />
          Prev
        </Button>
        <p className="hidden px-2 text-center text-xs leading-tight text-muted sm:block">
          Swipe right for next<br />Swipe left for previous
        </p>
        <Button
          variant="secondary"
          className="w-28 shrink-0 sm:w-36"
          disabled={index === cards.length - 1}
          onClick={() => move('next')}
        >
          Next
          <ChevronRight size={18} />
        </Button>
      </div>
      <p className="text-center text-xs text-muted sm:hidden">
        Swipe right for next · left for previous
      </p>
    </div>
  )
}
