import { Pool } from 'pg'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.warn(
    '[db] DATABASE_URL is not set. Accounts and sync are disabled; ' +
      'the app still runs fully in guest mode.',
  )
}

export const dbEnabled = Boolean(connectionString)

export const pool = connectionString
  ? new Pool({
      connectionString,
      // Railway terminates TLS with its own certificate chain.
      ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
    })
  : null

export async function query<T extends object = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!pool) throw new Error('Database is not configured')
  const res = await pool.query(text, params)
  return res.rows as T[]
}

export async function migrate() {
  if (!pool) return
  const sql = await readFile(path.join(import.meta.dirname, 'schema.sql'), 'utf8')
  await pool.query(sql)
  // Opportunistic cleanup so the sessions table does not grow forever.
  await pool.query('DELETE FROM sessions WHERE expires_at < now()')
  console.log('[db] schema ready')
}
