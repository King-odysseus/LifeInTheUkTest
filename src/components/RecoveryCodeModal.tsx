import { useState } from 'react'
import { useAuth } from '../store/auth'
import { Button } from './ui'

/**
 * With no email in the loop, this code is the only way back into an account
 * after a forgotten password - so it is shown once, blocking, with copy and
 * download to hand, and cannot be dismissed by accident.
 */
export default function RecoveryCodeModal() {
  const code = useAuth((s) => s.pendingRecoveryCode)
  const dismiss = useAuth((s) => s.dismissRecoveryCode)
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!code) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const download = () => {
    const blob = new Blob(
      [
        `Life in the UK Test - account recovery code\n\n${code}\n\n` +
          `Keep this safe. It is the only way to reset your password.\n`,
      ],
      { type: 'text/plain' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'life-in-the-uk-recovery-code.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-title"
    >
      <div className="card w-full max-w-md animate-scale-in p-6">
        <h2 id="recovery-title" className="text-lg font-semibold">
          Save your recovery code
        </h2>
        <p className="mt-2 text-sm text-muted">
          We do not send emails, so this code is the only way to reset your password if you forget
          it. Store it somewhere safe.
        </p>

        <p className="my-5 rounded-lg bg-brand-soft px-4 py-3 text-center font-mono text-lg tracking-wider text-brand select-all">
          {code}
        </p>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={download}>
            Download
          </Button>
        </div>

        <label className="mt-5 flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span>I have saved my recovery code somewhere safe.</span>
        </label>

        <Button className="mt-4 w-full" disabled={!confirmed} onClick={dismiss}>
          Continue
        </Button>
      </div>
    </div>
  )
}
