import { useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { APP_BUILD_ID, hardRefresh, previousBuildId, rememberBuildId } from '../lib/appUpdate'

/**
 * Shown once after a returning browser has an older build id recorded. The
 * marker is advanced immediately so a dismissed notice does not reappear on
 * every route change or reload — only after a genuinely newer build lands.
 */
export function AppUpdateNotice() {
  const [visible, setVisible] = useState(() => {
    const previous = previousBuildId()
    const hasUpdate = previous !== null && previous !== APP_BUILD_ID
    rememberBuildId()
    return hasUpdate
  })

  if (!visible) return null

  return (
    <div
      role="status"
      className="mb-5 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-3 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-ink sm:grid-cols-[auto_1fr_auto_auto]"
    >
      <RefreshCw size={18} className="shrink-0 text-brand" aria-hidden="true" />
      <span className="min-w-0 font-medium">
        A new version of the app is available. Refresh to load the latest content.
      </span>
      <button
        type="button"
        onClick={() => void hardRefresh()}
        className="col-start-2 flex min-h-11 items-center justify-center gap-2 justify-self-start rounded-full bg-brand px-4 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:col-start-3 sm:row-start-1"
      >
        <RefreshCw size={17} aria-hidden="true" />
        Refresh now
      </button>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss update notice"
        className="col-start-3 row-start-1 flex h-11 w-11 items-center justify-center self-start rounded-full text-muted transition hover:bg-surface-secondary hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:col-start-4 sm:self-center"
      >
        <X size={19} aria-hidden="true" />
      </button>
    </div>
  )
}
