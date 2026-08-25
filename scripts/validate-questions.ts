import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Question } from '../src/lib/types.ts'

/**
 * Gate for the question bank. Run this in CI before every deploy - at 2,000+
 * questions, hand-checking a batch is not realistic, and a single malformed
 * entry breaks a live exam.
 */

const DIR = path.join(import.meta.dirname, '..', 'src', 'data', 'questions')

const errors: string[] = []
const warnings: string[] = []

/** Catches near-duplicate stems that a plain equality check would miss. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || text.trim()
}

const files = (await readdir(DIR)).filter((f) => f.endsWith('.json')).sort()
const all: Question[] = []

for (const file of files) {
  const raw = await readFile(path.join(DIR, file), 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    errors.push(`${file}: invalid JSON — ${(err as Error).message}`)
    continue
  }
  if (!Array.isArray(parsed)) {
    errors.push(`${file}: expected an array of questions`)
    continue
  }

  const expectedChapter = Number(file.match(/chapter(\d)/)?.[1])

  for (const [i, q] of (parsed as Question[]).entries()) {
    const where = `${file}[${i}] ${q?.id ?? '(no id)'}`

    if (!q.id) errors.push(`${where}: missing id`)
    if (!q.question?.trim()) errors.push(`${where}: missing question text`)
    if (!q.explanation?.trim()) errors.push(`${where}: missing explanation`)
    if (!Array.isArray(q.options) || q.options.length < 2)
      errors.push(`${where}: needs at least 2 options`)
    if (!Array.isArray(q.correct) || q.correct.length === 0)
      errors.push(`${where}: no correct answer marked`)

    if (Array.isArray(q.correct) && Array.isArray(q.options)) {
      for (const idx of q.correct) {
        if (!Number.isInteger(idx) || idx < 0 || idx >= q.options.length)
          errors.push(`${where}: correct index ${idx} is out of range`)
      }
      if (new Set(q.correct).size !== q.correct.length)
        errors.push(`${where}: duplicate entries in correct[]`)

      if (q.type === 'single' && q.correct.length !== 1)
        errors.push(`${where}: type "single" must have exactly 1 correct answer`)
      if (q.type === 'multi' && q.correct.length < 2)
        errors.push(`${where}: type "multi" must have 2 or more correct answers`)
      if (q.type === 'boolean' && q.options.length !== 2)
        errors.push(`${where}: type "boolean" must have exactly 2 options`)
    }

    if (Array.isArray(q.options)) {
      const seen = new Set(q.options.map(normalise))
      if (seen.size !== q.options.length) errors.push(`${where}: duplicate option text`)
      if (q.options.some((o) => !o?.trim())) errors.push(`${where}: an option is empty`)
    }

    if (q.chapter !== expectedChapter)
      errors.push(`${where}: chapter ${q.chapter} does not match ${file}`)
    if (![1, 2, 3].includes(q.difficulty)) errors.push(`${where}: difficulty must be 1, 2 or 3`)
    if (!q.section?.trim()) warnings.push(`${where}: no section set`)
    if (!q.tags?.length) warnings.push(`${where}: no tags set`)

    // A stem that always names the right answer trains the wrong instinct.
    if (q.type === 'multi' && !/\bTWO\b|\btwo\b/.test(q.question))
      warnings.push(`${where}: multi-select stem should say how many to choose`)

    // The handbook's EU sections were removed after the UK left on 31/01/2020.
    // Anything still presenting the UK as a member is now simply wrong.
    const text = `${q.question} ${q.explanation}`
    if (/\b(is|remains)\s+(a\s+)?member\s+of\s+the\s+(European Union|EU)\b/i.test(text))
      errors.push(`${where}: presents the UK as an EU member; the UK left on 31 January 2020`)

    all.push(q)
  }
}

// ------------------------------------------------------------ cross-file checks

const byId = new Map<string, string>()
const byStem = new Map<string, string>()

for (const q of all) {
  if (byId.has(q.id)) errors.push(`Duplicate id "${q.id}"`)
  byId.set(q.id, q.id)

  const stem = normalise(q.question)
  const existing = byStem.get(stem)
  if (existing) errors.push(`Duplicate question text: "${q.id}" repeats "${existing}"`)
  byStem.set(stem, q.id)
}

// ------------------------------------------------------------------- report

for (const w of warnings) console.warn(`warn  ${w}`)
for (const e of errors) console.error(`error ${e}`)

console.log(
  `\n${all.length} questions across ${files.length} files — ` +
    `${errors.length} errors, ${warnings.length} warnings`,
)

// Questions tied to who currently holds an office or title. Listed on every run
// so they can be found and revised when the facts change, rather than being
// discovered by a user in the middle of a mock test.
const volatile = all.filter((q) => q.tags?.includes('volatile'))
if (volatile.length) {
  console.log(`\n${volatile.length} time-sensitive questions tagged "volatile":`)
  for (const q of volatile) console.log(`  ${q.id}  ${q.question}`)
}

if (all.length < 2000) {
  console.log(`Target is 2,000+. ${2000 - all.length} still to write.`)
}

process.exit(errors.length > 0 ? 1 : 0)
