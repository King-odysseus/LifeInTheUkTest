import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, CheckCircle2, Clock3, Flame, Sparkles } from 'lucide-react'
import { Alert, Button, ButtonLink, Card, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { getStudyProfile, recentAttempts, saveStudyProfile } from '../lib/db'
import { dueCount } from '../lib/srs'
import { buildDailyPlan, daysUntilExam, localDateKey, studyStreak } from '../lib/planning'
import type { Attempt, StudyProfile } from '../lib/types'
import { useAuth } from '../store/auth'

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

const TIMEZONES = [
  'Europe/London',
  'UTC',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Africa/Lagos',
]

export default function StudyPlan() {
  const user = useAuth((state) => state.user)
  const [profile, setProfile] = useState<StudyProfile | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [due, setDue] = useState(0)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void Promise.all([getStudyProfile(), recentAttempts(200), dueCount()])
      .then(([savedProfile, savedAttempts, dueCards]) => {
        setProfile(savedProfile)
        setAttempts(savedAttempts)
        setDue(dueCards)
      })
      .catch(() => setError('Could not load your study plan from browser storage.'))
  }, [user])

  const plan = useMemo(
    () => (profile ? buildDailyPlan(profile, attempts, due) : null),
    [profile, attempts, due],
  )

  if (!profile || !plan) {
    return error ? <div className="mx-auto max-w-xl py-10"><Alert>{error}</Alert></div> : <Spinner label="Building your study plan" />
  }

  const countdown = daysUntilExam(profile)
  const streak = studyStreak(attempts, profile)

  const toggleDay = (day: number) => {
    const selected = profile.preferredWeekdays.includes(day)
    setProfile({
      ...profile,
      preferredWeekdays: selected
        ? profile.preferredWeekdays.filter((value) => value !== day)
        : [...profile.preferredWeekdays, day].sort(),
    })
    setNotice('')
  }

  const useBrowserTimezone = () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: timezone })
      setProfile({ ...profile, timezone })
      setError('')
      setNotice('')
    } catch {
      setError('Your browser did not report a valid timezone. Please choose one from the list.')
    }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    if (profile.preferredWeekdays.length === 0) {
      setError('Choose at least one preferred study day.')
      setSaving(false)
      return
    }
    try {
      const saved = user ? (await api.saveStudyProfile(profile)).profile : profile
      await saveStudyProfile(saved)
      setProfile(saved)
      setNotice(user ? 'Study plan saved and synced.' : 'Study plan saved on this device.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your study plan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <p className="eyebrow">A routine you can keep</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Study plan</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Set your available time and test date. Recommendations adapt to due cards and previous mistakes.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3">
          <CalendarDays className="text-accent" size={22} aria-hidden="true" />
          <div><p className="text-2xl font-semibold tabular-nums">{countdown == null ? '—' : countdown < 0 ? 'Past' : countdown}</p><p className="text-xs text-muted">Days until test</p></div>
        </Card>
        <Card className="flex items-center gap-3">
          <Flame className="text-accent" size={22} aria-hidden="true" />
          <div><p className="text-2xl font-semibold tabular-nums">{streak}</p><p className="text-xs text-muted">Day practice streak</p></div>
        </Card>
        <Card className="flex items-center gap-3">
          <Clock3 className="text-accent" size={22} aria-hidden="true" />
          <div><p className="text-2xl font-semibold tabular-nums">{profile.dailyMinutes}</p><p className="text-xs text-muted">Minutes per study day</p></div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <h2 className="flex items-center gap-2 font-semibold"><Sparkles size={18} className="text-accent" />Today&rsquo;s revision</h2>
          {!plan.scheduledToday ? (
            <p className="mt-3 text-sm text-muted">Today is a rest day. You can still practise whenever you like.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {plan.tasks.map((task) => (
                <li key={task.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-medium">{task.title}</h3><p className="mt-1 text-xs leading-relaxed text-muted">{task.detail}</p></div>
                    <span className="shrink-0 text-xs font-semibold text-accent">{task.minutes} min</span>
                  </div>
                  <ButtonLink to={task.to} variant="secondary" className="mt-3">Start</ButtonLink>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">Plan settings</h2>
          <form onSubmit={save} className="mt-4 space-y-4">
            <label className="block text-sm font-medium">
              Test date
              <input type="date" value={profile.examDate ?? ''} min={localDateKey(Date.now(), profile.timezone)} onChange={(event) => setProfile({ ...profile, examDate: event.target.value || null })} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand" />
            </label>
            <label className="block text-sm font-medium">
              Minutes on each study day: <span className="tabular-nums text-brand">{profile.dailyMinutes}</span>
              <input type="range" min={5} max={90} step={5} value={profile.dailyMinutes} onChange={(event) => setProfile({ ...profile, dailyMinutes: Number(event.target.value) })} className="mt-2 w-full accent-brand" />
            </label>
            <fieldset>
              <legend className="text-sm font-medium">Preferred study days</legend>
              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((day) => (
                  <button key={day.value} type="button" aria-pressed={profile.preferredWeekdays.includes(day.value)} onClick={() => toggleDay(day.value)} className={`min-h-11 rounded-lg border text-xs font-semibold ${profile.preferredWeekdays.includes(day.value) ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted'}`}>{day.label}</button>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm font-medium">
              Timezone
              <select value={profile.timezone} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand">
                {[...new Set([...TIMEZONES, profile.timezone])].map((timezone) => <option key={timezone}>{timezone}</option>)}
              </select>
            </label>
            <Button type="button" variant="ghost" className="px-0" onClick={useBrowserTimezone}>Use my browser timezone</Button>
            {error && <Alert>{error}</Alert>}
            {notice && <Alert kind="good">{notice}</Alert>}
            <Button type="submit" disabled={saving || profile.preferredWeekdays.length === 0}>{saving ? 'Saving…' : 'Save plan'}</Button>
            {!user && <p className="text-xs text-muted">Sign in to sync these settings across devices.</p>}
          </form>
        </Card>
      </div>

      {attempts.length === 0 && <Card className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-accent" size={20} /><p className="text-sm text-muted">Your recommendations will become more specific after your first practice attempt.</p></Card>}
    </div>
  )
}
