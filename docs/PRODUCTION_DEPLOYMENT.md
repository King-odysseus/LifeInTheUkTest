# Production deployment

The production shape is one Railway service plus PostgreSQL. The Hono process serves both the API and the built SPA.

## Required environment

- `NODE_ENV=production`
- `DATABASE_URL` supplied by the linked PostgreSQL service
- `PORT` supplied by Railway (the server defaults to `8080`)

Never place production values in `.env.example`, source control, build arguments, or frontend variables.

## Deployment behaviour

The Docker build runs question validation and the complete production build. On process startup, `server/schema.sql` applies additive, idempotent migrations before the server accepts traffic. A migration failure terminates the process rather than serving against a partially compatible schema.

The `/api/health` endpoint is the Railway health check. A response with `accounts: false` means the site is usable only in local guest mode and the database connection must be investigated.

## Post-deploy checks

```text
GET /api/health
GET /
GET /practice
GET /plan
```

Expect HTTP 200 from every route. Responses should include `X-Request-Id`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and HSTS in production.

## Runtime operations

- Keep Railway at one replica while authentication throttling remains in memory.
- Review API logs using `X-Request-Id`; never add answer payloads, passwords, recovery values, or export content to logs.
- PostgreSQL session rows are cleaned opportunistically at startup.
- Treat account exports as personal data even though secret hashes and tokens are excluded.
