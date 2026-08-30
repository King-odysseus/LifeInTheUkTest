import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Field } from '../components/ui'
import { CalendarDays, Download, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import { clearLocalProgress, clearUserData } from '../lib/db'

export default function Account() {
  const navigate = useNavigate()
  const { user, loading, logout, syncUp } = useAuth()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [exporting, setExporting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  if (loading) return null
  if (!user) return <Navigate to="/signin" replace />

  const saveQuestion = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api.setSecurityQuestion(question, answer)
      setNotice('Security question saved. You can use it to reset your password.')
      setAnswer('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.')
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')
    try {
      await api.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setNotice('Password changed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password.')
    }
  }

  const downloadData = async () => {
    setExporting(true)
    setError('')
    setNotice('')
    try {
      await syncUp()
      const data = await api.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `life-in-the-uk-data-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setNotice('Your account data download has started.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not prepare your account data.')
    } finally {
      setExporting(false)
    }
  }

  const deleteAccount = async (event: FormEvent) => {
    event.preventDefault()
    setDeleting(true)
    setError('')
    try {
      await api.deleteAccount(deletePassword)
      await clearUserData().catch(() => undefined)
      useAuth.setState({ user: null, pendingRecoveryCode: null })
      navigate('/', { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete the account.')
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Account</h1>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="good">{notice}</Alert>}

      <Card>
        <h2 className="font-medium">Signed in as</h2>
        <p className="mt-1 text-sm text-muted">{user.username ?? user.email}</p>
        <Button
          variant="ghost"
          className="mt-3 px-0 md:hidden"
          onClick={() => void logout().then(() => navigate('/'))}
        >
          Sign out
        </Button>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <CalendarDays size={20} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <h2 className="font-medium">Study profile</h2>
            <p className="mt-1 text-sm text-muted">Set your test date, available minutes, preferred days and timezone.</p>
            <Button variant="secondary" className="mt-3" onClick={() => navigate('/plan')}>Open study plan</Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <Download size={20} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <h2 className="font-medium">Download my data</h2>
            <p className="mt-1 text-sm text-muted">Export your profile, attempts, answers and flashcard schedules as readable JSON. Passwords, recovery secrets and sessions are never included.</p>
            <Button variant="secondary" className="mt-3" disabled={exporting} onClick={() => void downloadData()}>{exporting ? 'Preparing…' : 'Download my data'}</Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-medium">Change password</h2>
        <p className="mt-1 text-sm text-muted">
          Change it here without an email or verification code.
        </p>
        <form onSubmit={changePassword} className="mt-3 space-y-3">
          <Field
            label="Current password"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Field
            label="New password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button type="submit" variant="secondary">Change password</Button>
        </form>
      </Card>

      <Card className="border-bad/40 bg-bad-soft/20">
        <div className="flex items-start gap-3">
          <Trash2 size={20} className="mt-0.5 shrink-0 text-bad" />
          <div className="min-w-0 flex-1">
            <h2 className="font-medium">Delete account</h2>
            <p className="mt-1 text-sm text-muted">Permanently removes your account and synced learning data. This cannot be undone.</p>
            {!deleteOpen ? (
              <Button variant="danger" className="mt-3" onClick={() => setDeleteOpen(true)}>Delete account</Button>
            ) : (
              <form onSubmit={deleteAccount} className="mt-4 space-y-3 rounded-xl border border-bad/30 bg-surface p-3">
                <p className="text-sm font-medium text-bad">Confirm permanent deletion with your current password.</p>
                <Field label="Current password" type="password" required autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="danger" disabled={deleting || !deletePassword}>{deleting ? 'Deleting…' : 'Permanently delete'}</Button>
                  <Button type="button" variant="secondary" disabled={deleting} onClick={() => { setDeleteOpen(false); setDeletePassword('') }}>Cancel</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-medium">Security question</h2>
        <p className="mt-1 text-sm text-muted">
          This lets you reset a forgotten password inside the app without an email or code. Choose
          an answer only you are likely to know.
        </p>
        <form onSubmit={saveQuestion} className="mt-3 space-y-3">
          <Field
            label="Question"
            placeholder="What was the name of your first school?"
            required
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Field
            label="Answer"
            required
            autoComplete="off"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <Button type="submit" variant="secondary">
            Save
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-medium">Local data</h2>
        <p className="mt-1 text-sm text-muted">
          Clears the practice history stored in this browser. Anything already synced to your
          account is not affected.
        </p>
        <Button
          variant="danger"
          className="mt-3"
          onClick={() => {
            if (confirm('Clear the practice history stored on this device?')) {
              void clearLocalProgress().then(() => setNotice('Local history cleared.'))
            }
          }}
        >
          Clear local history
        </Button>
      </Card>
    </div>
  )
}
