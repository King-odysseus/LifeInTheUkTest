import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Attaches per-statement explanations to true/false items in the fact files,
 * from the map in tf-explanations.json.
 *
 * True/false items originally inherited their fact's shared explanation, which
 * frequently discussed a different subject - a statement about the shadow
 * cabinet explained by a paragraph about the Cabinet, for instance. Keeping the
 * text in one keyed map makes the coverage gap visible: anything still listed
 * as missing has no explanation of its own yet.
 */

const DIR = path.join(import.meta.dirname, '..', 'src', 'data', 'facts')

interface TfItem {
  s: string
  v: boolean
  e?: string
}

// Split across several tf-explanations*.json files so the map can grow without
// rewriting entries that are already done.
const map: Record<string, string> = {}
for (const f of (await readdir(DIR)).filter((f) => /^tf-explanations.*\.json$/.test(f)).sort()) {
  Object.assign(map, JSON.parse(await readFile(path.join(DIR, f), 'utf8')) as Record<string, string>)
}

let applied = 0
let already = 0
const missing: string[] = []

for (const file of (await readdir(DIR)).filter((f) => f.startsWith('facts-') && f.endsWith('.json'))) {
  const full = path.join(DIR, file)
  const facts = JSON.parse(await readFile(full, 'utf8')) as { tf?: TfItem[] }[]
  let dirty = false

  for (const fact of facts) {
    for (const item of fact.tf ?? []) {
      const explanation = map[item.s]
      if (!explanation) {
        if (!item.e) missing.push(`${file}: ${item.s}`)
        continue
      }
      if (item.e === explanation) {
        already++
        continue
      }
      item.e = explanation
      applied++
      dirty = true
    }
  }

  if (dirty) await writeFile(full, `${JSON.stringify(facts, null, 2)}\n`)
}

console.log(`${applied} explanations attached, ${already} already current`)
if (missing.length) {
  console.log(`\n${missing.length} true/false statements still using their fact's shared explanation:`)
  for (const m of missing) console.log(`  ${m}`)
}
