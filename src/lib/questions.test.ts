import { describe, expect, it } from 'vitest'
import { isCorrect } from './questions'
import type { Question } from './types'

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    type: 'single',
    question: 'What is the capital of the UK?',
    options: ['London', 'Manchester', 'Leeds', 'Bristol'],
    correct: [0],
    explanation: 'London is the capital.',
    chapter: 1,
    section: 'Geography',
    difficulty: 1,
    tags: [],
    ...overrides,
  }
}

describe('isCorrect', () => {
  it('marks a single-answer question correct when the right option is chosen', () => {
    expect(isCorrect(makeQuestion(), [0])).toBe(true)
  })

  it('marks a single-answer question incorrect when the wrong option is chosen', () => {
    expect(isCorrect(makeQuestion(), [1])).toBe(false)
  })

  it('marks an unanswered question incorrect', () => {
    expect(isCorrect(makeQuestion(), [])).toBe(false)
  })

  it('is order-insensitive for multi-select questions', () => {
    const question = makeQuestion({ type: 'multi', correct: [0, 2] })
    expect(isCorrect(question, [2, 0])).toBe(true)
  })

  it('marks a partially correct multi-select answer as wrong', () => {
    const question = makeQuestion({ type: 'multi', correct: [0, 2] })
    expect(isCorrect(question, [0])).toBe(false)
    expect(isCorrect(question, [0, 1])).toBe(false)
  })

  it('rejects an answer with extra options beyond what is required', () => {
    const question = makeQuestion({ type: 'multi', correct: [0, 2] })
    expect(isCorrect(question, [0, 1, 2])).toBe(false)
  })
})
