import { LESSONS } from '../src/data/lessons.ts'
import { loadAll } from '../src/lib/questions.ts'

const questions = await loadAll()
const ids = new Set(questions.map((question) => question.id))
const errors: string[] = []
const seen = new Set<string>()

for (const lesson of LESSONS) {
  if (!lesson.id || seen.has(lesson.id)) errors.push(`Duplicate or missing lesson id: ${lesson.id}`)
  seen.add(lesson.id)
  if (!lesson.title.trim() || !lesson.summary.trim()) errors.push(`${lesson.id}: title and summary are required`)
  if (!lesson.source.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(lesson.reviewedAt)) errors.push(`${lesson.id}: source and ISO review date are required`)
  if (lesson.questionIds.length < 2) errors.push(`${lesson.id}: link at least two check questions`)
  for (const id of lesson.questionIds) if (!ids.has(id)) errors.push(`${lesson.id}: unknown question ${id}`)
}

if (errors.length) {
  console.error(`Lesson validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`)
  process.exit(1)
}
console.log(`Validated ${LESSONS.length} lessons and ${LESSONS.flatMap((lesson) => lesson.questionIds).length} lesson-question links.`)
