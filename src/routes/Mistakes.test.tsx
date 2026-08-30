import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Mistakes from './Mistakes'
import { saveAttempt } from '../lib/db'
import type { Attempt, Question } from '../lib/types'

const fakeQuestions: Question[] = [
  {
    id: 'q1',
    type: 'single',
    question: 'What year was the Battle of Hastings?',
    options: ['1066', '1215', '1415', '1815'],
    correct: [0],
    explanation: '1066 is when William of Normandy invaded.',
    chapter: 3,
    section: 'History',
    difficulty: 1,
    tags: [],
  },
  {
    id: 'q2',
    type: 'single',
    question: 'Who is the head of state?',
    options: ['The Monarch', 'The Prime Minister', 'The Speaker', 'The Mayor'],
    correct: [0],
    explanation: 'The Crown reigns; Parliament governs.',
    chapter: 5,
    section: 'Government',
    difficulty: 1,
    tags: [],
  },
]

vi.mock('../lib/questions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/questions')>()
  return {
    ...actual,
    loadAll: vi.fn(async () => fakeQuestions),
  }
})

function makeAttempt(takenAt: number, questionId: string, chosen: number[], correct: boolean): Attempt {
  return {
    id: `attempt-${takenAt}-${questionId}`,
    mode: 'custom',
    chapters: [],
    score: correct ? 1 : 0,
    total: 1,
    passed: correct,
    durationMs: 1000,
    takenAt,
    answers: [{ questionId, chosen, correct, timeMs: 100 }],
    synced: false,
  }
}

afterEach(() => {
  cleanup()
})

describe('Mistakes page', () => {
  it('shows only open mistakes by default and lets the learner mark one reviewed', async () => {
    await saveAttempt(makeAttempt(1, 'q1', [1], false))
    await saveAttempt(makeAttempt(2, 'q2', [1], false))

    const user = userEvent.setup()
    render(<Mistakes />)

    await waitFor(() => expect(screen.getByRole('heading', { name: /Battle of Hastings/i })).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: /head of state/i })).toBeInTheDocument()

    // Mark the Hastings card specifically, rather than relying on card order.
    const hastingsCard = screen
      .getByRole('heading', { name: /Battle of Hastings/i })
      .closest('div.card') as HTMLElement
    await user.click(within(hastingsCard).getByRole('button', { name: /mark reviewed/i }))

    // The reviewed item drops out of the "open" filter immediately.
    await waitFor(() => expect(screen.queryByRole('heading', { name: /Battle of Hastings/i })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: /head of state/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^reviewed \(/i }))
    await waitFor(() => expect(screen.getByRole('heading', { name: /Battle of Hastings/i })).toBeInTheDocument())
  })

  it('merges repeated misses into one card with an occurrence count', async () => {
    await saveAttempt(makeAttempt(1, 'q1', [1], false))
    await saveAttempt(makeAttempt(2, 'q1', [2], false))

    render(<Mistakes />)

    await waitFor(() => expect(screen.getByText(/Missed 2×/i)).toBeInTheDocument())
    expect(screen.getAllByText(/Battle of Hastings/i)).toHaveLength(1)
  })

  it('auto-resolves a mistake once answered correctly, so it lands under Reviewed not Open', async () => {
    await saveAttempt(makeAttempt(1, 'q1', [1], false))
    await saveAttempt(makeAttempt(2, 'q1', [0], true))

    const user = userEvent.setup()
    render(<Mistakes />)

    await waitFor(() => expect(screen.getByRole('button', { name: /^open \(0\)/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^reviewed \(/i }))
    expect(screen.getByRole('heading', { name: /Battle of Hastings/i })).toBeInTheDocument()
  })

  it('shows an empty state when there are no mistakes at all', async () => {
    render(<Mistakes />)
    await waitFor(() => expect(screen.getByText(/nothing in this view/i)).toBeInTheDocument())
  })
})
