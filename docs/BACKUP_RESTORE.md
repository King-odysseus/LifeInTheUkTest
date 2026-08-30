# Backup and restore

## Scope

Back up the PostgreSQL database. It contains accounts, profiles, sessions, attempts, answers, and spaced-repetition schedules. The question bank and frontend assets are reproducible from Git and the deployment image.

## Backup

Use Railway's managed backups when available and take an on-demand PostgreSQL backup before schema-changing releases. For a portable manual backup:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" --file life-in-the-uk.dump
pg_restore --list life-in-the-uk.dump
```

Store backups encrypted, outside the repository, with access limited to operators. Never paste a production database URL into logs or tickets.

## Restore

1. Stop or isolate application writes.
2. Create a fresh PostgreSQL database or confirm the exact intended restore target.
3. Restore the selected backup:

```bash
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$DATABASE_URL" life-in-the-uk.dump
```

4. Deploy the matching application version so additive migrations can run.
5. Verify `/api/health`, sign-in, profile loading, attempt history, and flashcard schedules.
6. Re-enable traffic only after verification.

## Recovery testing

Test restoration periodically against a disposable database. A backup is not considered usable until its archive can be listed and a representative account, attempt, answer set, profile, and SRS schedule can be read after restoration.
