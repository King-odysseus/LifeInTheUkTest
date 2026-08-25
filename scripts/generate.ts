import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import type { ChapterId, Difficulty, Question, QuestionType } from '../src/lib/types.ts'

/**
 * Expands hand-written facts into questions.
 *
 *   npx tsx scripts/generate.ts [outfile]
 *
 * Each fact carries one explanation and several "angles" - different ways of
 * asking about the same fact, which is how the real test covers a syllabus of
 * a few hundred points with a much larger question bank. The stems are written
 * by hand so they read naturally; only the distractors are chosen here, drawn
 * from a same-category pool so the wrong answers are always plausible.
 *
 * Selection is seeded on the angle's identity, so re-running produces identical
 * output and does not churn the question files.
 */

interface Angle {
  /** The question stem, written by hand. */
  q: string
  /**
   * Alternate wordings of the same question. Each becomes its own entry, with
   * its own distractor draw, so a fact can be revisited without the learner
   * meeting an identical stem twice.
   */
  alts?: string[]
  /** The correct answer, as it should appear in the options list. */
  a: string
  /** Key into pools.json. Distractors are drawn from here. */
  pool?: string
  /** Explicit distractors, when the pool would not produce good ones. */
  wrong?: string[]
  type?: QuestionType
  difficulty?: Difficulty
}

/** A true/false item. `v` is whether the statement is true. */
interface TrueFalse {
  s: string
  v: boolean
  difficulty?: Difficulty
}

/** A "choose TWO" item, matching the multi-select format of the real test. */
interface MultiAngle {
  q: string
  /** Exactly the answers that are correct. */
  a: string[]
  wrong: string[]
  difficulty?: Difficulty
}

interface Fact {
  id: string
  chapter: ChapterId
  section: string
  difficulty: Difficulty
  tags: string[]
  explanation: string
  angles?: Angle[]
  tf?: TrueFalse[]
  multi?: MultiAngle[]
}

const DIR = path.join(import.meta.dirname, '..', 'src', 'data', 'facts')
const outFile = process.argv[2] ?? path.join(DIR, 'generated.json')

const pools = JSON.parse(await readFile(path.join(DIR, 'pools.json'), 'utf8')) as Record<
  string,
  string[]
>

/** Deterministic PRNG so the same angle always yields the same paper. */
function seeded(seed: string): () => number {
  let h = parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 8), 16)
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0
    return h / 0x100000000
  }
}

function pick<T>(items: T[], n: number, rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out.slice(0, n)
}

/**
 * Options can be bare symbols - the pound sign, for instance - which strip to
 * an empty string and would then all compare equal. Fall back to the raw text
 * whenever normalising leaves nothing behind.
 */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '') || s.trim()

const questions: Question[] = []
const problems: string[] = []

const files = (await readdir(DIR)).filter((f) => f.startsWith('facts-') && f.endsWith('.json'))

for (const file of files.sort()) {
  const facts = JSON.parse(await readFile(path.join(DIR, file), 'utf8')) as Fact[]

  for (const fact of facts) {
    // ------------------------------------------------------------ true/false
    for (const [i, item] of (fact.tf ?? []).entries()) {
      questions.push({
        id: `${fact.id}-tf${i + 1}`,
        type: 'boolean',
        question: `Is the statement below TRUE or FALSE? ${item.s}`,
        options: ['True', 'False'],
        correct: [item.v ? 0 : 1],
        explanation: fact.explanation,
        chapter: fact.chapter,
        section: fact.section,
        difficulty: item.difficulty ?? fact.difficulty,
        tags: fact.tags,
      })
    }

    // --------------------------------------------------------- multi-select
    for (const [i, item] of (fact.multi ?? []).entries()) {
      const id = `${fact.id}-m${i + 1}`
      const rand = seeded(id)
      if (item.a.length < 2) {
        problems.push(`${id}: multi-select needs at least 2 correct answers`)
        continue
      }
      const options = pick([...item.a, ...item.wrong], item.a.length + item.wrong.length, rand)
      const correct = item.a.map((a) => options.findIndex((o) => norm(o) === norm(a)))
      if (correct.some((c) => c === -1)) {
        problems.push(`${id}: a correct answer was lost during shuffle`)
        continue
      }
      questions.push({
        id,
        type: 'multi',
        question: item.q,
        options,
        correct: correct.sort((a, b) => a - b),
        explanation: fact.explanation,
        chapter: fact.chapter,
        section: fact.section,
        difficulty: item.difficulty ?? fact.difficulty,
        tags: fact.tags,
      })
    }

    // -------------------------------------------------------- single choice
    for (const [i, angle] of (fact.angles ?? []).entries()) {
      // Each alternate wording is emitted as its own question.
      for (const [v, stem] of [angle.q, ...(angle.alts ?? [])].entries()) {
      const id = v === 0 ? `${fact.id}-${i + 1}` : `${fact.id}-${i + 1}v${v}`
      const rand = seeded(id)
      const type: QuestionType = angle.type ?? 'single'

      let wrong: string[]
      if (angle.wrong?.length) {
        wrong = angle.wrong
      } else if (angle.pool) {
        const pool = pools[angle.pool]
        if (!pool) {
          problems.push(`${id}: unknown pool "${angle.pool}"`)
          continue
        }
        // Never offer the right answer twice, even under different casing.
        wrong = pick(
          pool.filter((p) => norm(p) !== norm(angle.a)),
          3,
          rand,
        )
      } else {
        problems.push(`${id}: needs either a pool or explicit wrong answers`)
        continue
      }

      if (wrong.length < 3) {
        problems.push(`${id}: pool "${angle.pool}" gave only ${wrong.length} distractors`)
        continue
      }

      const options = pick([angle.a, ...wrong], 4, rand)
      const correct = options.findIndex((o) => norm(o) === norm(angle.a))
      if (correct === -1) {
        problems.push(`${id}: correct answer lost during shuffle`)
        continue
      }

      questions.push({
        id,
        type,
        question: stem,
        options,
        correct: [correct],
        explanation: fact.explanation,
        chapter: fact.chapter,
        section: fact.section,
        difficulty: angle.difficulty ?? fact.difficulty,
        tags: fact.tags,
      })
      }
    }
  }
}

for (const p of problems) console.error(`error ${p}`)

await writeFile(outFile, `${JSON.stringify(questions, null, 2)}\n`)
console.log(
  `${questions.length} questions generated from ${files.length} fact files -> ${path.basename(outFile)}`,
)
if (problems.length) {
  console.error(`${problems.length} facts skipped`)
  process.exit(1)
}
