import { create } from 'zustand'
import { api } from '../lib/api'
import { db, markSynced, restoreProgress, unsyncedAttempts } from '../lib/db'
import type { User } from '../lib/types'

interface AuthStore {
  user: User | null
  /** False when the deployment has no DATABASE_URL - guest mode only. */
  accountsEnabled: boolean
  loading: boolean
  /** Shown once, immediately after signup or a reset. Never recoverable later. */
  pendingRecoveryCode: string | null

  init: () => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  dismissRecoveryCode: () => void
  syncUp: () => Promise<void>
}

export const useAuth = create<AuthStore>((set, get) => ({
  user: null,
  accountsEnabled: true,
  loading: true,
  pendingRecoveryCode: null,

  async init() {
    try {
      const health = await api.health()
      if (!health.accounts) {
        set({ accountsEnabled: false, loading: false })
        return
      }
      const { user } = await api.me()
      set({ user, loading: false })
      if (user) void syncAccountProgress()
    } catch {
      // Offline, or the API is unreachable. Guest mode still works.
      set({ loading: false, accountsEnabled: false })
    }
  },

  async signup(email, password) {
    const { user } = await api.signup(email, password)
    set({ user, pendingRecoveryCode: null })
    await syncAccountProgress()
  },

  async login(email, password) {
    const { user } = await api.login(email, password)
    set({ user })
    await syncAccountProgress()
  },

  async logout() {
    await api.logout()
    // Local progress is deliberately left in place, so signing out drops the
    // user back into guest mode rather than wiping their history.
    set({ user: null })
  },

  dismissRecoveryCode() {
    set({ pendingRecoveryCode: null })
  },

  async syncUp() {
    if (!get().user) return
    const [pending, srs] = await Promise.all([unsyncedAttempts(), db.srs.toArray()])
    if (pending.length === 0 && srs.length === 0) return
    try {
      await Promise.all([
        pending.length ? api.pushAttempts(pending) : Promise.resolve(),
        srs.length ? api.pushSrs(srs) : Promise.resolve(),
      ])
      if (pending.length) await markSynced(pending.map((a) => a.id))
    } catch {
      // Leave attempts unsynced; the next successful call retries both parts.
    }
  },
}))

/** Adopts whatever the user did before they had an account. */
async function mergeGuestProgress() {
  const [attempts, srs] = await Promise.all([db.attempts.toArray(), db.srs.toArray()])
  if (attempts.length === 0 && srs.length === 0) return
  try {
    await api.merge(attempts, srs)
    await markSynced(attempts.map((a) => a.id))
  } catch {
    // Non-fatal: the attempts stay marked unsynced and retry later.
  }
}

/** Upload local work first, then restore the complete account copy locally. */
async function syncAccountProgress() {
  await mergeGuestProgress()
  try {
    const { attempts, srs } = await api.snapshot()
    await restoreProgress(attempts, srs)
  } catch {
    // Local progress remains usable and the next app start retries the restore.
  }
}
