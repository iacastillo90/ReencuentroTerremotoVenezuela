# Reencuentro Terremoto Venezuela — Agent Guide

Monorepo with two independent apps: `back/` (Express 5 API, CommonJS) and `front/` (React 19 SPA, ESM). No monorepo tooling — each has its own `package.json`, config, and tests.

---

## Quick Start

```bash
docker compose up -d              # Start Mongo 4.4, Redis 7, MinIO locally (run this yourself, not via agent)
cd back && npm install && npm run dev    # API → http://localhost:4000
cd front && npm install && npm run dev   # SPA → http://localhost:5173
```

Agent-safe commands (no Docker):
- `npm test` (back or front), `npx tsc --noEmit` (back), `npm run lint` (front)

---

## Backend (`back/`)

Node 22, Express 5, TypeScript 6, **CommonJS** (`"type": "commonjs"`).
Zod 4 for validation. Mongoose 9 for MongoDB. BullMQ + ioredis for queues.
MinIO for S3 storage. AI: Anthropic / OpenAI / Gemini (via `ai.factory.ts`).

```bash
npm run dev       # ts-node src/server.ts
npm run build     # tsc → outputs dist/
npm start         # node dist/src/server.js
npm test          # jest (ts-jest, supertest, mongodb-memory-server)
npm run reconcile # ts-node scripts/run-reconcile.ts
```

### Authentication & Security (added in feat/security)

```
request → helmet(CSP) → cors(whitelist) → morgan → rateLimit(100/15m)
        → cookieParser → csrfProtection → json(1mb) + hpp → routes
```

- **Auth**: JWT in **httpOnly cookie** (`token`, 7d, secure+sameSite=strict). No localStorage. Login via Google OAuth, logout increments `tokenVersion` to revoke all existing JWTs.
- **CSRF**: Double-submit cookie pattern — cookie `csrf-token` + header `x-csrf-token`. Exempted paths: webhooks, partners, auth/google, admin, localizados.
- **Helmet**: CSP in report-only by default (set `CSP_ENFORCE=true` to enforce), HSTS enabled.
- **CORS**: Whitelist from `CORS_ORIGINS` env var.
- **Globals**: 100 req/15min rate limit, PII excluded via safe Mongoose projections, pagination capped at `limit <= 200`.
- **Auth middleware** (`auth.middleware.ts`): `requireUser` (JWT + tokenVersion check against DB), `requireProfileComplete`, `requireAdminOrVerifier` (JWT admin/verifier or legacy `x-api-key` fallback), `requirePartnerApiKey`, `requireWebhookApiKey`.
- **Audit**: `AuditLogModel` (capped collection, 1M docs / 1GB) logs auth events, admin actions, validation failures, security violations. Manual `auditLog()` helper and automatic middleware factory available.
- **Validation**: All routes use Zod schemas with `sanitizedString` transform (strips HTML via sanitize-html). Input is sanitized before reaching business logic.
- **File upload**: Magic byte validation + filename sanitization before MinIO storage. Size limits: 5MB images, 20MB video.

### Key Architecture

- **Entrypoint**: `src/server.ts` — connects Mongo, initializes storage, sets up cron jobs, starts workers via **side-effect imports** (`import './workers/...'`).
- **Workers** (`src/workers/`): Long-running BullMQ processors. In production they run as a separate Render Background Worker.
- **Scrapers/jobs** (`src/jobs/`): Each is a cron-scheduled function wired in `server.ts`.
- **Adapters** (`src/adapters/`): `ISourceAdapter<T>` → `normalize()` returns Zod-validated `PersonPayload`. See `venezuela-te-busca.adapter.ts`.
- **Deduplication**: `idHash = SHA-256(normalizedName + state + age)`. Use `PersonModel.bulkWrite()` with `upsert: true` for bulk; `PersonModel.findOneAndUpdate()` with `$addToSet` on `externalIds` for singles.
- **Redis**: Cache `/persons/counts` (TTL 5 min), first page results (TTL 30s).
- **MinIO**: Storage service strips `https://` prefix from endpoint automatically.
- **Env**: Copy `.env.example` → `.env`. Required vars: `MONGO_URI`, `REDIS_URL`, `MINIO_*`, `JWT_SECRET` (required in production without fallback), `CORS_ORIGINS`, `VITE_GOOGLE_CLIENT_ID`.

### Testing

```bash
npm test                    # all tests
npx jest test/unit/person.route.test.ts   # single test
npx jest --forceExit        # if BullMQ timers hang (Redis not running locally)
npx tsc --noEmit            # typecheck only
```

- Tests in `back/test/unit/` — Jest + ts-jest + supertest + mongodb-memory-server.
- Heavily mock Mongoose and BullMQ queues via `jest.mock(...)`.
- No external MongoDB needed (in-memory server).
- **Mock `auth.middleware`** in route tests to avoid JWT verification.
- 18 test files, ~3400 lines. Tests may need `--forceExit` when Redis isn't running.

---

## Frontend (`front/`)

React 19, Vite 8, TypeScript 6, **ESM** (`"type": "module"`).
React Router 7, Axios, Leaflet/React-Leaflet, Lucide icons.
Oxlint (not ESLint). PWA via `vite-plugin-pwa`. CSS Variables (vanilla, dark theme).

```bash
npm run dev        # vite dev server
npm run build      # tsc -b && vite build  (typecheck → build — don't skip)
npm run test       # vitest run
npm run lint       # oxlint
npm run preview    # vite preview
```

### Authentication

- **Cookie-based JWT** (not localStorage). `AuthContext` calls `GET /api/auth/csrf-token` + `GET /api/auth/me` on mount.
- **API client** (`api.ts`): Axios with `withCredentials: true`. Request interceptor reads `csrf-token` cookie and attaches as `x-csrf-token` header for mutating requests.
- **DEV_MODE**: When `DEV_MODE=true` (blocked in production with security audit), Google token verification is skipped. Frontend shows a mock login button.

### Architecture

- **Routing**: Not react-router — custom `activeView` state with conditional rendering in `App.tsx`. Views: `feed`, `map`, `report`, `admin`, `library`, `profile`.
- **Map**: React-Leaflet must be **mocked in tests** (Leaflet does not work in jsdom). IntersectionObserver also needs mocking.
- **PWA**: `vite-plugin-pwa` with caching strategies. Security hardening applied in feat/security.

### Testing

```bash
npm test                          # all tests (vitest)
npx vitest run src/__tests__/App.test.tsx  # single test
```

- Tests in `src/__tests__/` — Vitest + jsdom + @testing-library/react.
- Globals enabled (`describe`, `it`, `expect`).
- Mock the API module (`vi.mock('../services/api')`) and React-Leaflet in every test.
- 4 test files covering App, AuthContext, AuthModal, vite config.

### Deployment (Vercel)

- `vercel.json`: SPA fallback (all routes → `/index.html`), static build from `dist/`.

---

## Pre-commit: Gentleman Guardian Angel (GGA)

Every commit triggers `gga run`, which uses Claude to review changed `.ts/.tsx/.js/.jsx` files (excluding tests) against rules in this file. This is the **only** pre-commit guard — no Husky, no lint-staged, no CI/CD.

If `gga` fails (Claude CLI not found, timeout, or review rejection), use `git commit --no-verify` to bypass.

---

## Validators (`back/src/validators/`)

All use `sanitizedString`/`sanitizedStringOptional` transforms for XSS prevention:

| File | Schemas |
|------|---------|
| `person.validator.ts` | `personPayloadSchema` — source, externalId, type, name, estado, text, photoUrl, date, confidence, reportedBy, isAnonymous, data |
| `auth.validator.ts` | `googleAuthSchema`, `profileUpdateSchema` |
| `admin.validator.ts` | `adminStatusUpdateSchema` (status enum), `adminMergeSchema` |
| `localizado.validator.ts` | `localizadoSubmissionSchema`, `localizadoPayloadSchema` (array 1-5000) |
| `partner.validator.ts` | `partnerCaseSchema`, `partnerCasesPayloadSchema` (array 1-1000) |
| `webhooks.validator.ts` | `webhookWhatsAppSchema`, `webhookTelegramSchema` |
| `venezuela.validator.ts` | Utility functions: `normalizeCedula()`, `normalizePhoneVE()`, `hashSensitiveData()` (not Zod) |

---

## Architecture Patterns

- **Adapter pattern**: `ISourceAdapter<T>` for each external data source → returns `PersonPayload`.
- **Async AI processing**: POST `/api/persons` → Zod validation → `addJobToIAQueue()` → 202 → BullMQ worker calls AI → creates/updates `UnifiedPerson`.
- **idHash deduplication**: SHA-256 of `normalizedName|state|age`. Never generated client-side.
- **Workers as side-effect imports**: `import './workers/my-worker'` in `server.ts` starts the worker automatically.
- **Security middleware order** in `app.ts`: helmet → cors → morgan → rateLimit → cookieParser → csrfProtection → json+hpp → routes. Order matters.
- **Audit bipartite**: `AuditLogModel` (capped collection) for security events + `StateHistoryModel` for person status change tracking.

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
| `back/src/server.ts` | App bootstrap, cron jobs, worker start via side-effect imports |
| `back/src/app.ts` | Express app setup: helmet, cors, morgan, rateLimit, CSRF, routes |
| `back/src/middlewares/auth.middleware.ts` | JWT auth with tokenVersion, admin/verifier/partner/webhook guards |
| `back/src/middlewares/csrf.middleware.ts` | Double-submit cookie CSRF protection |
| `back/src/middlewares/audit.middleware.ts` | Security event logging to capped AuditLog collection |
| `back/src/models/audit-log.model.ts` | Capped collection schema for security audit events |
| `back/src/models/unified-person.model.ts` | Core person schema: externalIds[], idHash, type, status, lastSeen GeoJSON |
| `back/src/services/person.service.ts` | upsertPerson with dedup logic |
| `back/src/validators/person.validator.ts` | Zod PersonPayload schema with sanitizedString |
| `back/src/utils/sanitize.util.ts` | sanitizedString/sanitizedStringOptional Zod transforms, escapeRegex |
| `back/src/utils/file-validate.util.ts` | Magic byte validation + filename sanitization |
| `back/src/config/redis.config.ts` | Redis connection (auto TLS) |
| `back/test/unit/person.route.test.ts` | Example route test pattern (mock auth middleware) |
| `front/src/App.tsx` | App shell, view routing, data fetching |
| `front/src/services/api.ts` | Axios client with CSRF interceptor (withCredentials: true) |
| `front/src/store/AuthContext.tsx` | Cookie-based JWT auth state |
| `front/src/types/index.ts` | Person & Disaster interfaces |
| `front/src/__tests__/App.test.tsx` | Example frontend test pattern (mock Leaflet) |
| `DEVELOPERS.md` | Full architecture reference |
| `TDD.md` | Technical design document |
| `Integraciones.md` | Data ingestion guide |
| `.gga` | Gentleman Guardian Angel config — pre-commit AI review |
