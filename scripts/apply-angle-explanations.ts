import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Attaches explanations to single-choice and multi-select items whose fact-level
 * explanation was too broad to answer them.
 *
 * Facts that summarise a whole period - "the 20th century brought two world
 * wars, votes for women, the welfare state" - are fine as context but useless
 * as the explanation for "which minister led the creation of the NHS". The map
 * is keyed by question stem, and setting `e` on an angle covers its alternate
 * wordings too, since those ask the same question.
 */

const DIR = path.join(import.meta.dirname, '..', 'src', 'data', 'facts')

interface Angle {
  q: string
  alts?: string[]
  e?: string
}
interface Fact {
  angles?: Angle[]
  multi?: Angle[]
}

const map: Record<string, string> = {}
for (const f of (await readdir(DIR)).filter((f) => /^angle-explanations.*\.json$/.test(f)).sort()) {
  Object.assign(map, JSON.parse(await readFile(path.join(DIR, f), 'utf8')) as Record<string, string>)
}

let applied = 0
const usedKeys = new Set<string>()

for (const file of (await readdir(DIR)).filter((f) => f.startsWith('facts-') && f.endsWith('.json'))) {
  const full = path.join(DIR, file)
  const facts = JSON.parse(await readFile(full, 'utf8')) as Fact[]
  let dirty = false

  for (const fact of facts) {
    for (const item of [...(fact.angles ?? []), ...(fact.multi ?? [])]) {
      // An alt matching is enough: it is the same question, reworded.
      const key = [item.q, ...(item.alts ?? [])].find((stem) => map[stem])
      if (!key) continue
      usedKeys.add(key)
      if (item.e === map[key]) continue
      item.e = map[key]
      applied++
      dirty = true
    }
  }

  if (dirty) await writeFile(full, `${JSON.stringify(facts, null, 2)}\n`)
}

console.log(`${applied} angle explanations attached`)

const unused = Object.keys(map).filter((k) => !usedKeys.has(k))
if (unused.length) {
  console.log(`\n${unused.length} map entries matched no question (stem may have changed):`)
  for (const u of unused) console.log(`  ${u}`)
}
