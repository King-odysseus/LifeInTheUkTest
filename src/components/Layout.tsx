import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Home,
  Landmark,
  LogIn,
  Monitor,
  Moon,
  Sun,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../store/auth'
import { getPref, setPref } from '../lib/db'

const links = [
  { to: '/', label: 'Home', mobileLabel: 'Home', icon: Home, end: true },
  { to: '/practice', label: 'Practice', mobileLabel: 'Practice', icon: ClipboardList },
  { to: '/study', label: 'Study', mobileLabel: 'Cards', icon: BookOpen },
  { to: '/stats', label: 'Progress', mobileLabel: 'Progress', icon: BarChart3 },
]

function ThemeToggle() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')

  useEffect(() => {
    void getPref<'system' | 'light' | 'dark'>('theme', 'system').then(setTheme)
  }, [])

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const cycle = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(next)
    void setPref('theme', next)
  }

  const Icon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon

  return (
    <button
      onClick={cycle}
      className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-secondary hover:text-ink md:h-9 md:w-9"
      aria-label={`Theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
    >
      <Icon size={18} />
    </button>
  )
}

export default function Layout() {
  const { user, accountsEnabled, logout } = useAuth()
  const location = useLocation()
  const showAccounts = accountsEnabled || import.meta.env.DEV
  const mobileLinks = showAccounts
    ? [
        ...links,
        user
          ? { to: '/account', label: 'Account', mobileLabel: 'Account', icon: UserRound }
          : { to: '/signin', label: 'Sign in', mobileLabel: 'Sign in', icon: LogIn },
      ]
    : links

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="flex min-h-16 w-full items-center gap-3 px-4 sm:px-6 md:gap-4 lg:px-8 xl:px-10">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight text-navy">
            <Landmark size={20} className="shrink-0 text-accent" />
            <span className="whitespace-nowrap">Life in the UK</span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm whitespace-nowrap ${
                    isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:text-ink'
                  }`
                }
              >
                <l.icon size={16} />
                <span>{l.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto md:ml-0">
            <ThemeToggle />
          </div>

          {/*
            A deployment with no database is guest-only, so in production the
            entry point is hidden rather than leading somewhere that cannot
            work. In development it always shows, otherwise the whole account
            flow is invisible and untestable on a machine with no Postgres.
          */}
          {showAccounts &&
            (user ? (
              <div className="hidden items-center gap-3 md:flex">
                <Link to="/account" className="max-w-32 truncate text-sm text-muted hover:text-ink">
                  {user.displayName ?? user.username ?? user.email}
                </Link>
                <button onClick={() => void logout()} className="text-sm text-muted hover:text-ink">
                  Sign out
                </button>
              </div>
            ) : (
              <Link to="/signin" className="hidden text-sm font-medium text-brand md:block">
                Sign in
              </Link>
            ))}
        </div>
      </header>

      <main className="w-full px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 md:py-8 lg:px-8 xl:px-10">
        <div key={location.pathname} className="animate-fade-up">
          <Outlet />
        </div>
      </main>

      <nav
        aria-label="Primary navigation"
        className={`fixed right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 z-40 mx-auto grid max-w-md ${
          mobileLinks.length === 5 ? 'grid-cols-5' : 'grid-cols-4'
        } gap-1 rounded-3xl border border-line bg-surface/95 p-1.5 shadow-elevated backdrop-blur-md md:hidden`}
      >
        {mobileLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={'end' in link ? link.end : undefined}
            aria-label={link.label}
            className={({ isActive }) =>
              `flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[0.6875rem] font-medium transition-colors ${
                isActive ? 'bg-brand-soft text-brand' : 'text-muted active:bg-surface-secondary'
              }`
            }
          >
            <link.icon size={20} strokeWidth={1.9} />
            <span className="max-w-full truncate">{link.mobileLabel}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
