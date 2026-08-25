/**
 * A random id that works outside a secure context.
 *
 * `crypto.randomUUID` is only defined on HTTPS and localhost. Open the app from
 * a phone on the same network - `http://192.168.1.20:5173` - and it is
 * undefined, so calling it throws. That took down saving a custom test and
 * recording a finished attempt, with no visible error: the work simply
 * vanished. `crypto.getRandomValues` has no such restriction.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    // Set the version (4) and variant bits so this is a well-formed UUID v4.
    bytes[6] = (bytes[6]! & 0x0f) | 0x40
    bytes[8] = (bytes[8]! & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  // Last resort. Not cryptographically strong, but these ids only need to be
  // unique within one browser's local history.
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random()
    .toString(16)
    .slice(2, 10)}`
}
