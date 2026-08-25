import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:opacity-90',
  gold: 'bg-accent-fill text-white hover:bg-accent-fill-hover',
  secondary: 'bg-surface text-ink border border-line hover:border-brand',
  ghost: 'text-muted hover:text-ink',
  danger: 'bg-bad text-white hover:opacity-90',
}

const base =
  'button-neomorphic inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium ' +
  'transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}

export function ButtonLink({
  to,
  variant = 'primary',
  className = '',
  children,
}: {
  to: string
  variant?: Variant
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  )
}

export function Field({
  label,
  hint,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        className={`w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink
          focus:border-brand focus:outline-none ${className}`}
        {...props}
      />
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`card p-4 sm:p-5 ${className}`}>{children}</div>
}

export function Alert({ kind = 'bad', children }: { kind?: 'bad' | 'good'; children: ReactNode }) {
  const tone = kind === 'bad' ? 'bg-bad-soft text-bad' : 'bg-good-soft text-good'
  return (
    <div role="alert" className={`rounded-lg px-3 py-2.5 text-sm ${tone}`}>
      {children}
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-muted" role="status">
      {label}…
    </div>
  )
}

/** Horizontal bar used for chapter mastery and score history. */
export function Meter({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const tone = pct >= 75 ? 'bg-good' : pct >= 50 ? 'bg-warn' : 'bg-bad'
  const [width, setWidth] = useState(0)
  const mounted = useRef(false)

  useEffect(() => {
    // Grow from zero on first paint, then ease between value changes.
    if (!mounted.current) {
      mounted.current = true
      const id = requestAnimationFrame(() => setWidth(pct))
      return () => cancelAnimationFrame(id)
    }
    setWidth(pct)
  }, [pct])

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line">
      <div
        className={`h-full rounded-full ${tone} transition-[width] duration-700 ease-out`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
