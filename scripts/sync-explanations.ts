import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Question } from '../src/lib/types.ts'

/**
 * Pushes explanation edits from the fact files into the merged question bank.
 *
 *   npx tsx scripts/generate.ts ./_gen.json
 *   npx tsx scripts/sync-explanations.ts ./_gen.json
 *
 * merge-batch renumbers ids on insert, so a regenerated question cannot be
 * matched back by id. The question stem is stable, so it is used as the key.
 * Only the explanation is copied - options and answers are left untouched, so
 * this cannot silently change what a question is asking or accept.
 */

const DIR = path.join(import.meta.dirname, '..', 'src', 'data', 'questions')

const genPath = process.argv[2]
if (!genPath) {
  console.error('usage: tsx scripts/sync-explanations.ts <generated.json>')
  process.exit(1)
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const generated = JSON.parse(await readFile(genPath, 'utf8')) as Question[]
const byStem = new Map<string, string>()
for (const q of generated) byStem.set(norm(q.question), q.explanation)

let updated = 0
let unchanged = 0
let unmatched = 0

for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.json')).sort()) {
  const full = path.join(DIR, file)
  const questions = JSON.parse(await readFile(full, 'utf8')) as Question[]
  let dirty = false

  for (const q of questions) {
    const fresh = byStem.get(norm(q.question))
    if (!fresh) {
      unmatched++
      continue
    }
    if (fresh === q.explanation) {
      unchanged++
      continue
    }
    q.explanation = fresh
    updated++
    dirty = true
  }

  if (dirty) await writeFile(full, `${JSON.stringify(questions, null, 2)}\n`)
}

console.log(
  `${updated} explanations updated, ${unchanged} already current, ` +
    `${unmatched} hand-written questions with no generated counterpart`,
)
