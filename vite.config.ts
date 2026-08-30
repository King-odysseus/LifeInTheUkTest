import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// A fresh id per build (rather than a hand-maintained version string) so the
// update notice never depends on a developer remembering to bump anything.
const buildId = process.env.SOURCE_VERSION ?? String(Date.now())

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Life in the UK Test Practice',
        short_name: 'Life in the UK',
        description:
          'Practice for the Life in the UK test with mock exams, chapter drills and spaced repetition.',
        theme_color: '#0B0B45',
        background_color: '#F8F9FA',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell and the question-bank chunks so the whole app
        // (mock exams, drills, flashcards) works offline. Progress is already
        // stored locally in IndexedDB via Dexie.
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        globIgnores: ['**/node_modules/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-nav-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Keep the question bank out of the main bundle - it is lazy loaded
        // per chapter, so each chapter becomes its own async chunk.
        manualChunks(id) {
          const m = id.match(/data[\/]questions[\/]chapter(\d)/)
          if (m) return `questions-ch${m[1]}`
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
})
