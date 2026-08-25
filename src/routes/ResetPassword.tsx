import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Field } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'

/**
 * Reset with no email in the loop. Step one looks up which recovery methods the
 * account has; step two takes the recovery code or the security-question answer
 * and a new password.
 */
export default function ResetPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'verify'>('email')
  const [identifier, setIdentifier] = useState('')
  const [securityQuestion, setSecurityQuestion] = useState<string | null>(null)
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const lookup = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { securityQuestion: q } = await api.recoveryOptions(identifier)
      if (!q) {
        setError('No recovery question is set for this account. If you are still signed in on another device, change your password from Account.')
        return
      }
      setSecurityQuestion(q)
      setStep('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not look up that account.')
    } finally {
      setBusy(false)
    }
  }

  const reset = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { user } = await api.reset({
        identifier,
        newPassword,
        securityAnswer: securityAnswer || undefined,
      })
      useAuth.setState({ user })
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <h1 className="text-lg font-semibold">Reset your password</h1>

        {step === 'email' ? (
          <form onSubmit={lookup} className="mt-5 space-y-4">
            {error && <Alert>{error}</Alert>}
            <Field
              label="Username or email"
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
            <Button type="submit" className="w-full" disabled={busy}>
              Continue
            </Button>
          </form>
        ) : (
          <form onSubmit={reset} className="mt-5 space-y-4">
            {error && <Alert>{error}</Alert>}

            {securityQuestion && (
              <Field
                label={securityQuestion}
                autoComplete="off"
                required
                hint="Answer the recovery question you set in Account."
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
              />
            )}

            <Field
              label="New password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              hint="At least 6 characters."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={busy || !securityAnswer}
            >
              {busy ? 'Resetting…' : 'Reset password'}
            </Button>
          </form>
        )}

        <p className="mt-4 text-sm text-muted">
          No recovery question set? Your progress on this device is safe. If you cannot change the
          password from a device where you are signed in, you can{' '}
          <Link to="/signup" className="text-brand">
            start a new account
          </Link>
          .
        </p>
      </Card>
    </div>
  )
}
