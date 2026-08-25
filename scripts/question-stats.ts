import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { CHAPTERS } from '../src/lib/types.ts'
import type { Question } from '../src/lib/types.ts'

/**
 * Shows how the bank is distributed against the exam weighting, so content
 * writing can be aimed at whichever chapter is furthest behind.
 */

const DIR = path.join(import.meta.dirname, '..', 'src', 'data', 'questions')
const TARGET = 2000

/**
 * Per-chapter targets, deliberately NOT the exam weighting.
 *
 * Chapters 1 and 2 cover small syllabuses - five principles, four nations, a
 * currency and a flag - and cannot yield 160 and 120 questions without padding.
 * They are capped at what can honestly be asked, and the shortfall is absorbed
 * by history and society, which have far more material than their weighting
 * needs.
 *
 * This does not change what a mock test looks like: buildExam samples by the
 * weights in CHAPTERS, so an exam still draws ~2 questions from chapter 1 and
 * ~10 from history however large each pool happens to be.
 */
const TARGETS: Record<number, number> = { 1: 100, 2: 70, 3: 900, 4: 650, 5: 380 }

const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'))
const all: Question[] = []
for (const file of files) {
  all.push(...(JSON.parse(await readFile(path.join(DIR, file), 'utf8')) as Question[]))
}

console.log(`\n${all.length} questions (target ${TARGET})\n`)
console.log('chapter                              have   target   gap   by type')
console.log('-'.repeat(78))

for (const ch of CHAPTERS) {
  const inChapter = all.filter((q) => q.chapter === ch.id)
  const target = TARGETS[ch.id] ?? Math.round(ch.weight * TARGET)
  const types = (['single', 'multi', 'boolean'] as const)
    .map((t) => `${t[0]}:${inChapter.filter((q) => q.type === t).length}`)
    .join(' ')

  console.log(
    `${ch.short.padEnd(34)} ${String(inChapter.length).padStart(5)} ` +
      `${String(target).padStart(8)} ${String(Math.max(0, target - inChapter.length)).padStart(5)}   ${types}`,
  )
}

const sections = new Map<string, number>()
for (const q of all) sections.set(q.section, (sections.get(q.section) ?? 0) + 1)

console.log(`\n${sections.size} sections covered. Thinnest:`)
for (const [section, count] of [...sections].sort((a, b) => a[1] - b[1]).slice(0, 8)) {
  console.log(`  ${String(count).padStart(4)}  ${section}`)
}
