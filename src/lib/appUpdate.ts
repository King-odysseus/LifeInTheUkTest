/**
 * A build id set at build time (see vite.config.ts) rather than a hand-edited
 * version string, so a returning browser can tell a newer deploy happened
 * without a developer remembering to bump anything.
 */
export const APP_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev'

const BUILD_ID_KEY = 'app-build-id'

export function previousBuildId(): string | null {
  try {
    return localStorage.getItem(BUILD_ID_KEY)
  } catch {
    return null
  }
}

export function rememberBuildId(): void {
  try {
    localStorage.setItem(BUILD_ID_KEY, APP_BUILD_ID)
  } catch {
    // Storage may be unavailable in private or locked-down contexts.
  }
}

/**
 * Forces the service worker to drop its cached app shell and reloads. This
 * only touches CacheStorage (the PWA's precache), never IndexedDB, so
 * attempts, flashcard schedules and any in-progress test survive untouched.
 */
export async function hardRefresh(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) await reg.update()
    } catch {
      // Fall through to a plain reload below.
    }
  }
  if ('caches' in window) {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    } catch {
      // Cache clearing is best effort; the reload below still runs.
    }
  }
  rememberBuildId()
  window.location.reload()
}
