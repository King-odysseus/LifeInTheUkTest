import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Field } from '../components/ui'
import { useAuth } from '../store/auth'

export default function SignIn() {
  const navigate = useNavigate()
  const login = useAuth((s) => s.login)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(identifier, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <h1 className="text-lg font-semibold">Sign in</h1>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {error && <Alert>{error}</Alert>}

          <Field
            label="Username or email"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-4 flex justify-between text-sm">
          <Link to="/signup" className="text-brand">
            Create an account
          </Link>
          <Link to="/reset" className="text-muted hover:text-ink">
            Forgot password
          </Link>
        </div>
      </Card>
    </div>
  )
}
