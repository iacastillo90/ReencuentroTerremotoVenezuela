# AGENTS.md — Backend (`back/`)

## Stack

- **Runtime:** Node.js 22, Express 5, TypeScript 6 (CommonJS)
- **Base de datos:** MongoDB 4.4 (Mongoose 9), replica sets simuladas con `mongodb-memory-server` en tests
- **Cache/Colas:** Redis 7 (ioredis, BullMQ 5)
- **AI:** Anthropic SDK / OpenAI SDK / Google Gen AI (provider pattern via `services/ai/ai.factory.ts`)
- **Storage:** MinIO / S3-compatible (Supabase Storage via `services/storage.service.ts`)
- **Auth:** JWT + Google OAuth + CSRF double-submit cookie + API keys legacy
- **Vector search:** Pinecone (opt-in via `USE_PINECONE_VECTOR_SEARCH=true`)
- **Validación:** Zod 4 (`validators/`)

## Entrypoints

| Archivo | Propósito |
|---|---|
| `src/server.ts` | Bootstrap: conecta MongoDB, Redis, inicia workers, arranca Express |
| `src/app.ts` | Configura Express: middleware global, CSP, CORS, rate limit, rutas |
| `src/workers/ia-processor.worker.ts` | Worker BullMQ que procesa texto libre con IA |
| `src/workers/disaster-sync.worker.ts` | Worker BullMQ para sincronización de desastres |

## Comandos exactos

```bash
# Desarrollo (con ts-node, hot-reload)
cd back && npm run dev

# Build
npm run build    # tsc → dist/

# Producción
npm start        # node dist/src/server.js

# Tests (Jest + ts-jest)
npm test

# Reconciliación manual
npm run reconcile

# Docker (infraestructura local)
docker compose up -d     # desde / del repo
```

## Rutas de la API

| Prefijo | Archivo | Auth |
|---|---|---|
| `GET /health` | inline en app.ts | — |
| `GET /api/persons` | `routes/person.route.ts` | Público (paginado, ?q=, ?status=) |
| `POST /api/persons` | `routes/person.route.ts` | Público |
| `PATCH /api/persons/:id/status` | `routes/person.route.ts` | Admin |
| `GET /api/persons/counts` | `routes/person.route.ts` | Cacheado Redis (TTL 5min) |
| `GET /api/disasters/active` | `routes/disasters.route.ts` | Público |
| `POST /api/report/ai` | `routes/person.route.ts` | Público (202 + encola IA) |
| `GET/POST /api/admin/*` | `routes/admin.route.ts` | `x-api-key` o JWT admin |
| `POST /api/sync` | `routes/admin.route.ts` | Admin |
| `POST /api/webhooks/*` | `routes/webhooks.route.ts` | `x-webhook-api-key` |
| `POST /api/partners/*` | `routes/partner.route.ts` | `x-partner-api-key` |
| `POST /api/localizados` | `routes/localizado.route.ts` | `x-partner-api-key` |
| `POST /api/auth/google` | `routes/auth.route.ts` | Exento de CSRF |
| `POST /api/csp-report` | (from helmet) | — |

## Seguridad

- **CSP:** Modo `reportOnly` a menos que `CSP_ENFORCE=true`
- **Rate limit:** 100 req / 15 min por IP (global)
- **CSRF:** Doble cookie + header; exento para `/api/webhooks`, `/api/partners`, `/api/auth/google`, `/api/admin`, `/api/localizados`
- **Auth:** JWT en `Authorization: Bearer` o cookie `token`; `tokenVersion` en DB para revocación
- **PII:** Los campos sensibles se excluyen vía proyección de Mongoose
- **Paginación:** `limit <= 200` para prevenir scraping masivo

## Modelos clave

| Modelo | Archivo | Propósito |
|---|---|---|
| `UnifiedPerson` | `models/unified-person.model.ts` | Persona unificada (deduplicada por `idHash`) |
| `DisasterEvent` | `models/disaster-event.model.ts` | Eventos de desastre con GeoJSON |
| `User` | `models/user.model.ts` | Usuarios (Google OAuth) |
| `Localizado` | `models/localizado.model.ts` | Personas localizadas en refugios/hospitales |
| `AuditLog` | `models/audit-log.model.ts` | Auditoría de acciones admin |
| `SyncState` | `models/sync-state.model.ts` | Estado de sincronización de fuentes |

## Patrón de ingesta de datos (integración de fuentes)

Toda fuente externa debe seguir:

1. **Extraer** datos (API, CSV, web scraping)
2. **Mapear** al esquema `UnifiedPerson`
3. **Firmar** con `idHash = crypto.createHash('sha256').update(\`${SOURCE_ID}-${externalId}\`).digest('hex')`
4. **Upsert masivo** con `PersonModel.bulkWrite()` en chunks de 100

Ver `Integraciones.md` y ejemplos en `back/src/adapters/`.

## Tests

```bash
# Todos los tests
npm test

# Solo un archivo
npx jest src/__tests__/api.test.ts
```

- Backend usa **Jest + ts-jest** con `mongodb-memory-server` (no necesita MongoDB real)
- Las integraciones con servicios externos (IA, Redis) se mockean
- Los tests de API usan **supertest**

## Estructura del backend

```
back/src/
├── adapters/          # Adaptadores de fuentes externas (venezuela-te-busca, web-form)
├── config/            # redis.config.ts (auto-detecta TLS para Upstash)
├── jobs/              # Scrapers programados (node-cron)
├── middlewares/       # auth.middleware.ts, csrf.middleware.ts, audit.middleware.ts
├── models/            # Mongoose schemas (11 modelos)
├── queues/            # BullMQ queue definitions
├── routes/            # Express routers (11 archivos)
├── services/          # Lógica de negocio: ai/, scrapers/, storage, matcher, bridge, etc.
├── utils/             # Utilidades
├── validators/        # Schemas Zod (7 archivos)
├── workers/           # BullMQ workers (IA processor, disaster sync)
└── __tests__/         # Tests
```

## Gotchas

- **Express 5** tiene cambios en el manejo de errores async — los errores lanzados en async route handlers ya no necesitan `express-async-errors`.
- **Zod 4** tiene breaking changes respecto a v3 (`.parse()` vs `.safeParse()`, etc).
- **Mongoose 9** tiene cambios en tipos — los documentos extienden `Document` de manera diferente.
- **BullMQ 5** cambió la API de `Worker` y `Queue` — requiere `connection` explícita.
- `tsconfig.json` incluye `**/*.js` — cuidado con archivos JS legacy en `scripts/`.
- El embedding de Pinecone solo se activa con `USE_PINECONE_VECTOR_SEARCH=true`.
- `data` field en `UnifiedPerson` es `Schema.Types.Mixed` — debe validarse con Zod **antes** de llegar al modelo.
