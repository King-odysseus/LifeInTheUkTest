import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Field } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import { clearLocalProgress } from '../lib/db'

export default function Account() {
  const navigate = useNavigate()
  const { user, loading, logout } = useAuth()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

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
