import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { compress } from 'hono/compress'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth.ts'
import { progressRoutes } from './routes/progress.ts'
import { dbEnabled, migrate } from './db.ts'

const isProd = process.env.NODE_ENV === 'production'

const app = new Hono()

// The question bank is the bulk of what this server sends, and it is highly
// compressible JSON. Without this every visitor downloads roughly three times
// the bytes, which is billed egress on a hosted platform.
app.use('*', compress())

// In production, log the API only. Logging every static asset multiplies log
// volume by the number of files on each page load for no diagnostic gain.
app.use(isProd ? '/api/*' : '*', logger())

app.get('/api/health', (c) => c.json({ ok: true, accounts: dbEnabled }))

/**
 * Without a database the app is still fully usable in guest mode, so the API
 * degrades to a clear 503 rather than crashing the process on boot.
 */
app.use('/api/*', async (c, next) => {
  if (!dbEnabled && c.req.path !== '/api/health') {
    return c.json({ error: 'Accounts are not available on this deployment.' }, 503)
  }
  await next()
})

app.route('/api/auth', authRoutes)
app.route('/api/progress', progressRoutes)

app.onError((err, c) => {
  console.error('[api]', err)
  return c.json({ error: 'Something went wrong. Please try again.' }, 500)
})

// ------------------------------------------------------- static SPA hosting

// In development Vite serves the client and proxies /api here, so only the
// built app needs serving in production.
if (isProd) {
  app.use(
    '/assets/*',
    serveStatic({
      root: './dist',
      // Hashed filenames, so these are safe to cache indefinitely.
      onFound: (_path, c) => c.header('Cache-Control', 'public, max-age=31536000, immutable'),
    }),
  )
  app.use('/*', serveStatic({ root: './dist' }))
  // Client-side routing: anything not matched above falls back to the shell.
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

const port = Number(process.env.PORT ?? 8080)

await migrate().catch((err) => {
  console.error('[db] migration failed', err)
  process.exit(1)
})

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`[server] listening on :${info.port} (accounts ${dbEnabled ? 'on' : 'off'})`)
})
