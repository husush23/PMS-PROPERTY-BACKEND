# OpenAPI artifacts

- **`openapi.json`** — generated OpenAPI 3 document (not hand-edited).
- **`openapi.d.ts`** — optional TypeScript types for the frontend (generated from `openapi.json`).

## Generate

From repo root (requires the same `.env` / database connectivity as `nest start`, because the app module bootstraps TypeORM):

```bash
npm run openapi:export
```

Then generate TS types for a frontend repo (or this monorepo):

```bash
npm run openapi:types
```

If `openapi:export` fails on DB connection, start Postgres or point `DATABASE_*` env vars at a reachable instance, then retry.

You can also copy the spec from a running server: `GET http://localhost:8000/api/docs-json` (port and prefix may differ).
