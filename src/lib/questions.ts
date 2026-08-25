import { CHAPTERS, type ChapterId, type Difficulty, type Question } from './types'

/**
 * Each chapter is its own async chunk (see vite.config.ts), so a 2,000-question
 * bank never lands in the initial bundle. A chapter is fetched on first use and
 * cached for the session.
 */
// JSON imports widen literal unions to `string`, so the shape is asserted here
// and enforced for real by scripts/validate-questions.ts at build time.
const loaders: Record<ChapterId, () => Promise<{ default: unknown }>> = {
  1: () => import('../data/questions/chapter1.json'),
  2: () => import('../data/questions/chapter2.json'),
  3: () => import('../data/questions/chapter3.json'),
  4: () => import('../data/questions/chapter4.json'),
  5: () => import('../data/questions/chapter5.json'),
}

const cache = new Map<ChapterId, Question[]>()

export async function loadChapter(id: ChapterId): Promise<Question[]> {
  const cached = cache.get(id)
  if (cached) return cached
  const mod = await loaders[id]()
  const questions = mod.default as Question[]
  cache.set(id, questions)
  return questions
}

export async function loadChapters(ids: ChapterId[]): Promise<Question[]> {
  const chunks = await Promise.all(ids.map(loadChapter))
  return chunks.flat()
}

export async function loadAll(): Promise<Question[]> {
  return loadChapters(CHAPTERS.map((c) => c.id))
}

export async function findQuestions(ids: string[]): Promise<Question[]> {
  const wanted = new Set(ids)
  const all = await loadAll()
  const byId = new Map(all.map((q) => [q.id, q]))
  // Preserve the order the caller asked for.
  return ids.filter((id) => wanted.has(id)).flatMap((id) => {
    const q = byId.get(id)
    return q ? [q] : []
  })
}

// ------------------------------------------------------------------ sampling

export function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

function take<T>(items: T[], n: number): T[] {
  return shuffle(items).slice(0, n)
}

/**
 * Builds a 24-question paper whose chapter mix matches the real exam rather
 * than being uniformly random - history carries far more weight than the rest.
 * Any shortfall in a chapter is topped up from the remaining pool so the paper
 * is always full length.
 */
export async function buildExam(count: number): Promise<Question[]> {
  const all = await loadAll()
  const byChapter = new Map<ChapterId, Question[]>()
  for (const q of all) {
    const list = byChapter.get(q.chapter) ?? []
    list.push(q)
    byChapter.set(q.chapter, list)
  }

  const picked: Question[] = []
  // Largest-remainder allocation, so the counts sum to exactly `count`.
  const quotas = CHAPTERS.map((ch) => ({ ch, exact: ch.weight * count }))
  const base = quotas.map((q) => ({ ...q, n: Math.floor(q.exact) }))
  let remaining = count - base.reduce((sum, q) => sum + q.n, 0)
  for (const q of [...base].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (remaining <= 0) break
    q.n += 1
    remaining -= 1
  }

  for (const { ch, n } of base) {
    picked.push(...take(byChapter.get(ch.id) ?? [], n))
  }

  if (picked.length < count) {
    const chosen = new Set(picked.map((q) => q.id))
    picked.push(...take(all.filter((q) => !chosen.has(q.id)), count - picked.length))
  }

  return shuffle(picked)
}

export interface SampleOptions {
  chapters?: ChapterId[]
  count?: number
  difficulty?: Difficulty[]
  /** Restrict the pool to these question ids, e.g. a weak-areas drill. */
  only?: string[]
  exclude?: string[]
}

export async function sampleQuestions(opts: SampleOptions = {}): Promise<Question[]> {
  const chapters = opts.chapters?.length ? opts.chapters : CHAPTERS.map((c) => c.id)
  let pool = await loadChapters(chapters)

  if (opts.only?.length) {
    const only = new Set(opts.only)
    pool = pool.filter((q) => only.has(q.id))
  }
  if (opts.exclude?.length) {
    const exclude = new Set(opts.exclude)
    pool = pool.filter((q) => !exclude.has(q.id))
  }
  if (opts.difficulty?.length) {
    const levels = new Set(opts.difficulty)
    pool = pool.filter((q) => levels.has(q.difficulty))
  }

  return opts.count ? take(pool, opts.count) : shuffle(pool)
}

// ------------------------------------------------------------------- marking

/** Order-insensitive, and a partially correct multi-select counts as wrong. */
export function isCorrect(question: Question, chosen: number[]): boolean {
  if (chosen.length !== question.correct.length) return false
  const answer = new Set(question.correct)
  return chosen.every((i) => answer.has(i))
}

export function requiredAnswers(question: Question): number {
  return question.correct.length
}

export const chapterTitle = (id: ChapterId) =>
  CHAPTERS.find((c) => c.id === id)?.title ?? `Chapter ${id}`
