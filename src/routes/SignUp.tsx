import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Field } from '../components/ui'
import { useAuth } from '../store/auth'

/**
 * Two fields, one button. No confirm-password, no verification email, no
 * strength meter - the sign-up wall is where practice apps lose people.
 */
export default function SignUp() {
  const navigate = useNavigate()
  const signup = useAuth((s) => s.signup)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signup(identifier, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <h1 className="text-lg font-semibold">Create an account</h1>
        <p className="mt-1 text-sm text-muted">
          Save your scores, see whether you are improving, and continue on another device.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {error && <Alert>{error}</Alert>}

          <Field
            label="Username or email"
            autoComplete="username"
            required
            hint="Use a simple username, or your email if you prefer."
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            hint="At least 6 characters. That is the only rule."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-4 text-sm text-muted">
          Already have one?{' '}
          <Link to="/signin" className="text-brand">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  )
}
