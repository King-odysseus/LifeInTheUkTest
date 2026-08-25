import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Question } from '../src/lib/types.ts'

/**
 * Appends a batch of authored questions into the right chapter file.
 *
 *   npx tsx scripts/merge-batch.ts <batch.json>
 *
 * Batches are written a chapter at a time, so this routes by each question's
 * `chapter` field, renumbers ids to stay sequential, and drops anything whose
 * stem already exists. Re-running the same batch is a no-op.
 */

const DIR = path.join(import.meta.dirname, '..', 'src', 'data', 'questions')

const batchPath = process.argv[2]
if (!batchPath) {
  console.error('usage: tsx scripts/merge-batch.ts <batch.json>')
  process.exit(1)
}

const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const batch = JSON.parse(await readFile(batchPath, 'utf8')) as Question[]

const byChapter = new Map<number, Question[]>()
for (const q of batch) {
  const list = byChapter.get(q.chapter) ?? []
  list.push(q)
  byChapter.set(q.chapter, list)
}

let added = 0
let skipped = 0

for (const [chapter, incoming] of byChapter) {
  const file = path.join(DIR, `chapter${chapter}.json`)
  const existing = JSON.parse(await readFile(file, 'utf8')) as Question[]

  const stems = new Set(existing.map((q) => normalise(q.question)))
  // Continue the existing id sequence rather than trusting the batch's numbering.
  let nextId = existing.reduce((max, q) => {
    const n = Number(q.id.split('-')[1])
    return Number.isFinite(n) ? Math.max(max, n) : max
  }, 0)

  const accepted: Question[] = []
  for (const q of incoming) {
    const stem = normalise(q.question)
    if (stems.has(stem)) {
      skipped++
      continue
    }
    stems.add(stem)
    nextId++
    accepted.push({ ...q, id: `c${chapter}-${String(nextId).padStart(3, '0')}` })
  }

  await writeFile(file, `${JSON.stringify([...existing, ...accepted], null, 2)}\n`)
  added += accepted.length
  console.log(`chapter${chapter}.json  +${accepted.length}  (now ${existing.length + accepted.length})`)
}

console.log(`\n${added} added, ${skipped} skipped as duplicates`)
