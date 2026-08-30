# Release checklist

## Before release

- Confirm the worktree contains only intended changes: `git status --short`.
- Install exactly the locked dependencies with `npm ci`.
- Run `npm run typecheck`.
- Run `npm run questions:validate` and review any volatile-question warnings.
- Run `npm run build`.
- Confirm no secrets, database URLs, exports, or local editor files are staged.
- Confirm a recent database backup exists before a schema-changing deployment.

## Release

- Push the reviewed commit to the deployment branch.
- Watch the Railway build through question validation, client build, and server build.
- Do not promote a build whose database migration failed.

## After release

- Verify `GET /api/health` returns HTTP 200 and reports accounts enabled.
- Load `/`, `/practice`, `/study`, `/stats`, and `/plan` directly to verify SPA fallback routing.
- Sign in with a non-owner test account and verify profile save, progress sync, data export, and sign out.
- Confirm security headers and `X-Request-Id` are present.
- Start and submit one short practice set, then confirm it appears in Progress.
- Check production logs for migration, API, or service-worker errors.

## Rollback

- Redeploy the previous known-good application image or commit.
- The schema changes are additive; do not drop new tables during an application rollback.
- If data restoration is required, follow [BACKUP_RESTORE.md](./BACKUP_RESTORE.md).
