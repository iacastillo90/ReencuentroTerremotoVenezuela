# Reencuentro Terremoto Venezuela — Agent Guide

Monorepo with two independent apps: `back/` (Express 5 API) and `front/` (React 19 SPA). No monorepo tooling — each has its own `package.json`, config, and tests.

---

## Infrastructure

```bash
docker compose up -d              # Start Mongo 4.4, Redis 7, MinIO locally
```

## Backend (`back/`)

Node 22, Express 5, TypeScript 6, **CommonJS** (`"type": "commonjs"`).
Zod 4 for validation. Mongoose 9 for MongoDB. BullMQ + ioredis for queues.
MinIO client for S3-compatible storage. AI providers: Anthropic, OpenAI, Gemini.

```bash
npm run dev       # ts-node src/server.ts
npm run build     # tsc  → outputs dist/
npm start         # node dist/src/server.js
npm test          # jest (ts-jest, supertest, mongodb-memory-server)
npm run reconcile # ts-node scripts/run-reconcile.ts
```

- **Entrypoint**: `src/server.ts` — connects Mongo, initializes storage, sets up cron jobs, **starts workers via side-effect imports** (`import './workers/...'`).
- **Workers** (`src/workers/`) are long-running BullMQ processors. In production they also run as a separate Render Background Worker (`dist/src/workers/ia-processor.worker.js`).
- **Scrapers/jobs**: `src/jobs/` — each is a function scheduled via `node-cron` in `src/server.ts`.
- **Adapters** (`src/adapters/`): normalize external data sources → `PersonPayload` (validated via Zod).
- **Deduplication core**: `idHash = SHA-256(source + externalId)` — use `PersonModel.bulkWrite()` with `upsert: true` for bulk ingestion; use `PersonModel.findOneAndUpdate()` with `$addToSet` on `externalIds` for single records in `services/person.service.ts`.
- **Security**: global rate limit 100 req/15min; admin routes require `x-api-key` header; PII excluded via safe Mongoose projections; pagination capped at `limit <= 200`.
- **Redis** caches `/persons/counts` (TTL 5 min) and first page results (TTL 30 s).
- **Storage**: MinIO endpoint must have `https://` prefix stripped — storage service sanitizes it.
- **Env**: copy `.env.example` → `.env`. Local Docker defaults work out of the box.

### Testing (Backend)

- Tests in `back/test/unit/` — Jest + `ts-jest` + `supertest` + `mongodb-memory-server`.
- Heavily mock Mongoose and BullMQ queues via `jest.mock(...)` in route/integration tests.
- No external MongoDB needed (in-memory server spawns automatically).
- Run all: `npm test` at `back/`. Single test: `npx jest test/unit/person.route.test.ts`.

## Frontend (`front/`)

React 19, Vite 8, TypeScript 6, **ESM** (`"type": "module"`).
React Router 7, Axios, Leaflet/React-Leaflet, Lucide icons.
Oxlint (not ESLint). PWA via `vite-plugin-pwa`. Styled with CSS Variables (vanilla, dark theme).

```bash
npm run dev        # vite dev server
npm run build      # tsc -b && vite build  (typecheck → build)
npm run test       # vitest run
npm run lint       # oxlint
npm run preview    # vite preview
```

- **Build order**: `tsc -b` (typecheck) → `vite build` (bundle). Don't skip typecheck.
- **Env**: `VITE_API_URL` defaults to `http://localhost:4000/api`.
- **API client**: `src/services/api.ts` — Axios instance. Auth token attached as `Authorization: Bearer` header.
- **Auth**: JWT-based, stored in `localStorage`, managed via `AuthContext` in `src/store/`.
- **Routing**: Not using react-router — custom `activeView` state with conditional rendering in `App.tsx`. Pages: `feed`, `map`, `report`, `admin`, `library`, `profile`.
- **Map**: React-Leaflet must be **mocked in tests** (Leaflet does not work in jsdom).

### Testing (Frontend)

- Tests in `src/__tests__/` — Vitest 4 + jsdom + `@testing-library/react`.
- Globals enabled (`describe`, `it`, `expect` available without import).
- Mock the API module (`vi.mock('../services/api')`) and React-Leaflet components in every test.
- Run all: `npm test` at `front/`. Single test: `npx vitest run src/__tests__/App.test.tsx`.

### Deployment (Vercel)

- `vercel.json`: SPA fallback (all routes → `/index.html`), static build from `dist/`.

---

## Architecture Patterns

- **Adapter pattern**: Implement `ISourceAdapter<T>` in `src/adapters/` for each external data source. The adapter's `normalize()` returns a `PersonPayload` (validated by Zod). See `venezuela-te-busca.adapter.ts` as reference.
- **Async AI processing**: POST to `/api/persons` → Zod validation → `addJobToIAQueue()` → returns 202 → BullMQ worker calls AI provider → creates/updates `UnifiedPerson`.
- **idHash deduplication**: SHA-256 hash of `normalizedName + lastSeen.state + age`. This is the unique key. Never generate it client-side.
- **UnifiedPerson schema**: See `back/src/models/unified-person.model.ts`. Key fields: `externalIds[]`, `idHash` (unique), `type` (person|animal), `status`, `lastSeen` (GeoJSON), `metadata.auditStatus`, `metadata.urgencyScore`.
- **Workers are side-effect imports**: Adding `import './workers/my-worker'` to `server.ts` starts the worker automatically. They share the same Mongo/Redis connections.

---

## Relevant Skills

Load these when the task matches:
- `react-19` — React 19 patterns (hooks, compiler, control flow)
- `typescript` — strict TS patterns
- `zod-4` — Zod 4 schema validation (used in backend)
- `form-security` — secure form handling for report submissions
- `github-pr` — PR creation with conventional commits
- `screaming-architecture` — frontend structure conventions (optional)
- `sdd-*` — all SDD lifecycle skills for spec-driven development

---

## Key Files

| File | Purpose |
|------|---------|
| `back/src/server.ts` | App bootstrap, worker start |
| `back/src/app.ts` | Express app setup, routes, middleware |
| `back/src/models/unified-person.model.ts` | Core schema |
| `back/src/services/person.service.ts` | upsertPerson with dedup logic |
| `back/src/adapters/base.adapter.ts` | Adapter interface for data sources |
| `back/src/validators/person.validator.ts` | Zod PersonPayload schema |
| `back/src/config/redis.config.ts` | Redis connection (auto TLS) |
| `back/test/unit/person.route.test.ts` | Example route test pattern |
| `front/src/App.tsx` | App shell, view routing, data fetching |
| `front/src/services/api.ts` | Axios client |
| `front/src/types/index.ts` | Person & Disaster interfaces |
| `front/src/__tests__/App.test.tsx` | Example frontend test pattern |
| `DEVELOPERS.md` | Full architecture reference |
| `TDD.md` | Technical design document |
| `Integraciones.md` | Data ingestion guide |
