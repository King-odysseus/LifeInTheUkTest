# Life in the UK Test

Practice app for the Life in the UK citizenship test. React + TypeScript on the front, Hono + Postgres on the back, deployed as a single Railway service.

## Running locally

```bash
npm install
npm run dev          # Vite on :5173, API on :8080
```

`DATABASE_URL` is optional. Without it the app runs in **guest mode**: every test, drill and statistic works, stored in the browser's IndexedDB. Accounts and cross-device sync are the only things that need Postgres.

```bash
npm run build              # typecheck + production bundle
npm start                  # serve the built app from the Hono server
npm run questions:validate # gate the question bank (runs in the Docker build)
npm run questions:stats    # coverage against the 2,000-question target
npm run typecheck          # tsc, no emit
npm test                   # Vitest suite, once
npm run test:watch         # Vitest in watch mode
```

Frontend tests run on Vitest + Testing Library in jsdom, with `fake-indexeddb` standing in for the browser's IndexedDB so the Dexie layer is exercised for real rather than mocked.

## Deploying to Railway

1. Create a project and add a **Postgres** service.
2. Add a service from this repo. Railway detects the `Dockerfile`.
3. Link the database so `DATABASE_URL` is injected. Nothing else is required — the schema is applied on boot.

`railway.json` sets the healthcheck to `/api/health`, which reports whether accounts are available.

## How accounts work

Deliberately minimal, because a sign-up wall is where practice apps lose people:

- **Guest by default.** The app opens straight into a test. No account is ever required.
- **Signup** is a username or email and a 6-character password. No verification, confirm field or strength rules.
- **Simple in-app recovery.** A signed-in user can change their password directly. They can also set a security question for forgotten-password recovery without an email or verification code.
- **Cross-device progress.** Local guest work is merged into the account and the complete attempt/SRS history is restored after sign-in. The Progress page shows the score trend in percentage points.
- **Account-backed flashcards.** Every flashcard grade updates its spaced-repetition schedule, syncs for signed-in users, and contributes to learning/mastered totals on the Progress page.
- **90-day sliding sessions**, so the cheapest reset is the one nobody needs.
- **Rate limited** to 10 attempts per IP per minute on auth routes.

Passwords use `scrypt` from `node:crypto` with a per-password salt; sessions are httpOnly, SameSite=Lax cookies stored in Postgres.

> The in-memory rate limiter is per-process. If this ever scales past one Railway replica, move it to Postgres or Redis.

## Resuming an unfinished test

An in-progress test is snapshotted to IndexedDB after every meaningful change — questions, current position, answers, flags, per-question timings and the deadline. A refresh, a closed tab or a browser restart therefore loses nothing: the Home screen offers **Resume test** or **Discard**.

A timed test keeps its *original* deadline rather than restarting the clock. If that deadline passed while the browser was closed, resuming submits the attempt with whatever was answered instead of handing back a test whose time is already gone. Finished tests are cleared from the slot, so they never reappear as resumable. All of this is local-first and works with no account.

## Mistake Bank

`/mistakes` derives every missed question from local attempt history — no server sync in this direction. Repeated misses on the same question merge into a single entry with an occurrence count, shown alongside the learner's latest answer, the correct answer, the explanation, and the chapter and section.

Answering a question correctly later resolves its mistake automatically. Entries can also be marked reviewed or reopened by hand; those manual overrides live in Dexie preferences and take precedence over the automatic state. Filter by **Open**, **Reviewed** or **All**. Reachable from the Progress page.

## Update notices

`vite.config.ts` injects a fresh `__APP_BUILD_ID__` on every build, so nothing has to be bumped by hand. A returning browser holding an older id sees a dismissible notice with **Refresh now**, which updates the service worker and drops its CacheStorage entries. IndexedDB is never touched, so attempts, flashcard schedules and any in-progress test survive the refresh. The notice never appears on a first visit.

## The question bank

Questions live in `src/data/questions/chapterN.json`, one file per handbook chapter. Vite emits each as its own async chunk, so the full question bank never lands in the initial bundle.

The official question bank is confidential and unpublished, so these are authored from *Life in the United Kingdom: A Guide for New Residents* (3rd ed.). **1,596 questions are in place; the target is 2,000+.** `npm run questions:stats` shows the gap per chapter.

Adding questions:

1. Append to the relevant `chapterN.json`, following the existing shape.
2. Run `npm run questions:validate`. It fails the build on duplicate ids, duplicate or near-duplicate stems, out-of-range answer indices, type/answer-count mismatches, missing explanations and chapter mismatches.

Mock tests sample by the real exam's chapter weighting (history ~40%), not uniformly — see `buildExam` in `src/lib/questions.ts`.

## Layout

```
server/            Hono API — auth, progress sync, static hosting
  schema.sql       applied on every boot, idempotent
src/lib/           question engine, IndexedDB, SM-2 scheduling, API client
src/store/         zustand stores for auth and the active test
src/routes/        screens
scripts/           question bank validation and coverage tooling
```

## Not yet built

- Handbook study notes alongside the questions
- Google sign-in
- The remaining 404 questions needed to reach the 2,000-question target
