import type { Attempt, StudyProfile } from './types'

export interface DailyTask {
  id: string
  title: string
  detail: string
  minutes: number
  to: string
}

export function localDateKey(timestamp: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function isoWeekday(timestamp: number, timezone: string): number {
  const short = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short' }).format(
    new Date(timestamp),
  )
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(short) + 1
}

function shiftDateKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10)
}

export function studyStreak(attempts: Attempt[], profile: StudyProfile, now = Date.now()): number {
  if (!attempts.length) return 0
  const active = new Set(attempts.map((attempt) => localDateKey(attempt.takenAt, profile.timezone)))
  const today = localDateKey(now, profile.timezone)
  let cursor = active.has(today) ? today : shiftDateKey(today, -1)

  let days = 0
  for (let checked = 0; checked < 366; checked += 1) {
    if (!active.has(cursor)) break
    days += 1
    cursor = shiftDateKey(cursor, -1)
  }
  return days
}

export function daysUntilExam(profile: StudyProfile, now = Date.now()): number | null {
  if (!profile.examDate) return null
  const target = new Date(`${profile.examDate}T00:00:00Z`).getTime()
  if (!Number.isFinite(target)) return null
  const today = new Date(`${localDateKey(now, profile.timezone)}T00:00:00Z`).getTime()
  return Math.ceil((target - today) / (24 * 60 * 60 * 1000))
}

export function buildDailyPlan(
  profile: StudyProfile,
  attempts: Attempt[],
  dueCards: number,
  now = Date.now(),
): { scheduledToday: boolean; tasks: DailyTask[] } {
  const scheduledToday = profile.preferredWeekdays.includes(isoWeekday(now, profile.timezone))
  if (!scheduledToday) return { scheduledToday, tasks: [] }

  const tasks: DailyTask[] = []
  let minutes = profile.dailyMinutes
  if (dueCards > 0 && minutes >= 5) {
    const allocation = Math.min(10, minutes)
    tasks.push({
      id: 'flashcards',
      title: `Review ${dueCards} due card${dueCards === 1 ? '' : 's'}`,
      detail: 'Strengthen facts just before you are likely to forget them.',
      minutes: allocation,
      to: '/study',
    })
    minutes -= allocation
  }

  const hasMistakes = attempts.some((attempt) => attempt.answers.some((answer) => !answer.correct))
  if (hasMistakes && minutes >= 5) {
    const allocation = Math.min(15, minutes)
    tasks.push({
      id: 'weak',
      title: 'Practise weak areas',
      detail: 'Prioritise questions you have previously missed.',
      minutes: allocation,
      to: '/practice',
    })
    minutes -= allocation
  }

  if (hasMistakes && minutes >= 5) {
    const allocation = Math.min(10, minutes)
    tasks.push({ id: 'learn', title: 'Learn a difficult topic', detail: 'Use a short lesson to connect facts you have missed.', minutes: allocation, to: '/study/learn' })
    minutes -= allocation
  }

  if (minutes >= 15) {
    tasks.push({
      id: 'mock',
      title: 'Take a full mock test',
      detail: 'Measure your progress under the real 45-minute rules.',
      minutes,
      to: '/practice',
    })
  } else if (minutes >= 5 || tasks.length === 0) {
    tasks.push({
      id: 'quick',
      title: attempts.length ? 'Complete a Quick 10' : 'Start your first Quick 10',
      detail: 'A short mixed set keeps your revision moving.',
      minutes: Math.max(5, minutes),
      to: '/practice',
    })
  }
  return { scheduledToday, tasks }
}
