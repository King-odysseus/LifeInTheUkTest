import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Question } from '../src/lib/types.ts'

/**
 * Hunts for questions whose explanation does not support the marked answer.
 *
 * At this size the bank cannot be proofread by hand, and a wrong or mismatched
 * explanation is worse than a missing one: the learner is taught the error and
 * has no reason to doubt it. These are heuristics, so everything reported is a
 * candidate for review rather than a proven defect.
 */

const DIR = path.join(import.meta.dirname, '..', 'src', 'data', 'questions')

const STOP = new Set([
  'the', 'a', 'an', 'of', 'in', 'to', 'and', 'or', 'is', 'was', 'were', 'are', 'for', 'on', 'at',
  'by', 'with', 'that', 'this', 'it', 'as', 'from', 'be', 'been', 'has', 'have', 'had', 'which',
  'who', 'what', 'when', 'where', 'how', 'many', 'their', 'they', 'its', 'his', 'her', 'not', 'no',
  'all', 'any', 'some', 'more', 'most', 'other', 'than', 'then', 'there', 'these', 'those', 'you',
  'your', 'own', 'only', 'also', 'can', 'may', 'must', 'will', 'would', 'should', 'about', 'into',
  'over', 'under', 'after', 'before', 'each', 'every', 'both', 'true', 'false', 'statement', 'below',
  'following', 'these', 'uk', 'britain', 'british', 'england', 'people', 'first', 'one', 'two',
])

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))

interface Finding {
  id: string
  file: string
  kind: string
  detail: string
  question: string
}

const findings: Finding[] = []
const files = (await readdir(DIR)).filter((f) => f.endsWith('.json')).sort()
let total = 0

for (const file of files) {
  const questions = JSON.parse(await readFile(path.join(DIR, file), 'utf8')) as Question[]

  for (const q of questions) {
    total++
    const expl = q.explanation.toLowerCase()
    const explWords = new Set(words(q.explanation))

    const correctText = q.correct.map((i) => q.options[i] ?? '').join(' ')
    const distractors = q.options.filter((_, i) => !q.correct.includes(i))

    if (q.type === 'boolean') {
      // The explanation must speak to the subject of the statement. A shared
      // explanation inherited from a sibling item usually fails this.
      const stem = q.question.replace(/^Is the statement below TRUE or FALSE\?\s*/i, '')
      const stemWords = words(stem)
      const overlap = stemWords.filter((w) => explWords.has(w)).length
      const ratio = stemWords.length ? overlap / stemWords.length : 1
      if (stemWords.length >= 3 && ratio < 0.25) {
        findings.push({
          id: q.id,
          file,
          kind: 'boolean-explanation-mismatch',
          detail: `only ${overlap}/${stemWords.length} key terms of the statement appear in the explanation`,
          question: stem,
        })
      }
      continue
    }

    // A distractor quoted verbatim in the explanation while the correct answer
    // is absent is the signature of a mis-marked answer.
    const correctWords = words(correctText)
    const correctHit =
      correctWords.length === 0 ||
      correctWords.some((w) => explWords.has(w)) ||
      expl.includes(correctText.toLowerCase())

    const quotedDistractor = distractors.find(
      (d) => d.length > 6 && expl.includes(d.toLowerCase()),
    )

    // An explanation that shares almost no vocabulary with the question is
    // usually a fact-level summary inherited by a specific item - the NHS
    // founder answered with a paragraph about the whole 20th century.
    const qWords = words(q.question)
    const qOverlap = qWords.filter((w) => explWords.has(w)).length
    if (qWords.length >= 3 && qOverlap === 0) {
      findings.push({
        id: q.id,
        file,
        kind: 'explanation-is-off-topic',
        detail: `no key term of the question appears in the explanation`,
        question: q.question,
      })
      continue
    }

    if (!correctHit && quotedDistractor) {
      findings.push({
        id: q.id,
        file,
        kind: 'answer-may-be-wrong',
        detail: `explanation quotes the distractor "${quotedDistractor}" but not the marked answer "${correctText}"`,
        question: q.question,
      })
    } else if (!correctHit) {
      findings.push({
        id: q.id,
        file,
        kind: 'explanation-does-not-mention-answer',
        detail: `marked answer "${correctText}" does not appear in the explanation`,
        question: q.question,
      })
    }
  }
}

const byKind = new Map<string, Finding[]>()
for (const f of findings) {
  byKind.set(f.kind, [...(byKind.get(f.kind) ?? []), f])
}

for (const [kind, items] of [...byKind].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n=== ${kind} (${items.length}) ===`)
  for (const f of items) {
    console.log(`  ${f.id}  ${f.question}`)
    console.log(`      ${f.detail}`)
  }
}

console.log(`\n${findings.length} candidates out of ${total} questions`)
