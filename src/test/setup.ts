import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { db } from '../lib/db'

// Every test gets an empty database. Clearing tables (rather than closing the
// connection and swapping the IndexedDB backend) avoids races with a
// component's in-flight query from the previous test.
afterEach(async () => {
  await Promise.all([db.attempts.clear(), db.srs.clear(), db.prefs.clear(), db.activeTest.clear()])
  localStorage.clear()
})
