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
```

## Deploying to Railway

1. Create a project and add a **Postgres** service.
2. Add a service from this repo. Railway detects the `Dockerfile`.
3. Link the database so `DATABASE_URL` is injected. Nothing else is required — the schema is applied on boot.

`railway.json` sets the healthcheck to `/api/health`, which reports whether accounts are available.

Operational guidance lives in [`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md),
[`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md), and
[`docs/BACKUP_RESTORE.md`](docs/BACKUP_RESTORE.md).

## How accounts work

Deliberately minimal, because a sign-up wall is where practice apps lose people:

- **Guest by default.** The app opens straight into a test. No account is ever required.
- **Signup** is a username or email and a 6-character password. No verification, confirm field or strength rules.
- **Simple in-app recovery.** A signed-in user can change their password directly. They can also set a security question for forgotten-password recovery without an email or verification code.
- **Cross-device progress.** Local guest work is merged into the account and the complete attempt/SRS history is restored after sign-in. The Progress page shows the score trend in percentage points.
- **Account-backed flashcards.** Every flashcard grade updates its spaced-repetition schedule, syncs for signed-in users, and contributes to learning/mastered totals on the Progress page.
- **Adaptive study planning.** Test date, daily minutes, preferred days and timezone produce a local-first daily plan, exam countdown and practice streak. Settings sync for signed-in users.
- **Explainable readiness.** Performance, chapter coverage, recency and practice volume are shown separately; the combined indicator is revision guidance rather than an official result prediction.
- **Account privacy controls.** Signed-in learners can download a JSON copy of their learning data or permanently delete the account after confirming their current password.
- **90-day sliding sessions**, so the cheapest reset is the one nobody needs.
- **Rate limited** to 10 attempts per IP per minute on auth routes.

Passwords use `scrypt` from `node:crypto` with a per-password salt; sessions are httpOnly, SameSite=Lax cookies stored in Postgres.

> The in-memory rate limiter is per-process. If this ever scales past one Railway replica, move it to Postgres or Redis.

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
