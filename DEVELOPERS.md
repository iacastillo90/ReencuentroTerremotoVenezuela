# Guía Técnica para Desarrolladores

**Proyecto:** Reencuentro Terremoto Venezuela

Documento de referencia técnica para ingenieros que se integran al proyecto. Cubre arquitectura, stack, estructura del repositorio, endpoints, seguridad, autenticación, workers, y comandos de desarrollo.

---

## Stack Tecnológico

### Frontend (`front/`)

- **Core:** React 19, TypeScript 6, Vite 8 (SWC)
- **Ruteo:** Por estado (`useState<View>`), 13 vistas, sin URLs
- **Estilos:** CSS plano con Custom Properties (tema oscuro obligatorio)
- **Mapas:** Leaflet + react-leaflet 5 + react-leaflet-cluster
- **Íconos:** Lucide React
- **Auth:** Google OAuth (`@react-oauth/google`) + email/password + JWT
- **HTTP:** Axios con interceptor CSRF automático (double-submit cookie + retry en 403)
- **PWA:** Service Worker personalizado (injectManifest) + Dexie 4 (IndexedDB offline)
- **Tiempo real:** Socket.IO (notificaciones + chat)
- **Linter:** Oxlint (no ESLint, no Prettier)
- **Tests:** Vitest 4 + jsdom + @testing-library/react
- **Monitoreo:** Sentry (error tracking + performance + session replay)
- **Despliegue:** Vercel (SPA fallback + proxy /api a Render)

### Backend (`back/`)

- **Core:** Node.js 22, Express 5, TypeScript 6 (CommonJS)
- **Base de datos:** MongoDB 7 (Mongoose 9 ODM), índices 2dsphere
- **Caché y colas:** Redis 7 (ioredis) + BullMQ 5 (4 colas)
- **Validación:** Zod 4 (9 esquemas, toda entrada validada)
- **IA:** Multi-provider via factory pattern (Anthropic Claude, OpenAI GPT, Google Gemini)
- **Almacenamiento:** Cliente MinIO / AWS S3 SDK (compatible Supabase Storage)
- **Auth:** JWT (HS256), google-auth-library, scrypt (passwords), API keys (SHA-256)
- **Logs:** Pino (estructurado, redacción automática de PII)
- **Monitoreo:** Sentry + Bull Board (UI de colas)
- **Tiempo real:** Socket.IO con Redis adapter y rooms (usuario, moderador, chat, LOPNNA)
- **Tests:** Jest 30 + ts-jest 29 + mongodb-memory-server + supertest
- **Despliegue:** Render (Web Service + Background Worker independiente)

### Visión (`vision/`)

- **Runtime:** Python 3.11, FastAPI
- **Face recognition:** dlib + face_recognition (encoding 128-d)
- **Age estimation:** Caffe DNN (age_net.caffemodel)
- **Endpoints:** `/extract-face` (POST), `/blur-faces` (POST), `/health` (GET)

---

## Estructura del Repositorio

```
ReencuentroTerremotoVenezuela/
├── front/                          # SPA React 19
│   ├── src/
│   │   ├── __tests__/              # Tests (App, Auth, AuthModal, offlineDb, sync)
│   │   ├── assets/                 # Imágenes (hero, logo)
│   │   ├── components/
│   │   │   ├── common/             # 12 componentes (CategorySelector, ChatWidget, etc.)
│   │   │   ├── map/                # Leaflet (Map, MapFilters, MapLegend)
│   │   │   ├── modals/             # ReportModal (7 pasos), PersonDetailModal, AuthModal
│   │   │   └── ui/                 # Button, Input (design system)
│   │   ├── constants/              # routes.ts (definición de vistas)
│   │   ├── data/                   # library.json (datos estáticos)
│   │   ├── db/                     # offlineDb.ts (Dexie IndexedDB)
│   │   ├── hooks/                  # usePersons, useBackgroundSync, useNetworkStatus
│   │   ├── layouts/                # AppLayout, MobileBottomNav
│   │   ├── pages/                  # 11 páginas
│   │   │   ├── Admin/              # Dashboard (8 secciones)
│   │   │   ├── Auth/               # Login, Register
│   │   │   ├── Directory/          # Organizaciones verificadas
│   │   │   ├── Feed/               # Infinite scroll
│   │   │   ├── Home/               # HomePage + HomeGateway
│   │   │   ├── Library/            # Recursos
│   │   │   ├── Logistics/          # Alertas logísticas
│   │   │   ├── Manual/             # Guías éticas
│   │   │   ├── Map/                # Mapa interactivo
│   │   │   ├── Profile/            # Perfil (3 tabs)
│   │   │   └── Search/             # Búsqueda normal + IA
│   │   ├── services/               # api.ts (Axios + CSRF interceptor)
│   │   ├── store/                  # AuthContext, SocketContext, ToastContext
│   │   ├── types/                  # Person, Disaster, SearchRequest
│   │   ├── utils/                  # sync-utils, humanizeError
│   │   ├── App.tsx                 # Ruteo por estado
│   │   ├── main.tsx                # Entrypoint (árbol de providers)
│   │   ├── sw.ts                   # Service Worker personalizado
│   │   └── index.css               # Variables CSS, tema oscuro
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── vercel.json
│   └── .oxlintrc.json
│
├── back/                           # API REST + Workers
│   ├── scripts/                    # Mantenimiento y despliegue
│   └── src/
│       ├── __tests__/              # Tests (api, batch, disaster-sync, etc.)
│       ├── adapters/               # 6 adaptadores (ISourceAdapter)
│       ├── config/                 # redis.config.ts
│       ├── controllers/            # 14 controladores (capa delgada)
│       ├── database/               # Conexión MongoDB
│       ├── jobs/                   # 14 scrapers programados
│       ├── middlewares/            # 6 middlewares (auth, csrf, error, audit, validate, correlation)
│       ├── models/                 # 13 modelos Mongoose
│       ├── queues/                 # 4 colas BullMQ
│       ├── routes/                 # 13 routers Express
│       ├── services/               # ~27 servicios (capa gruesa)
│       │   ├── admin/              # 6 servicios admin
│       │   ├── ai/                 # 4 archivos (factory + 3 providers)
│       │   ├── legacy/             # Bridge SQL heredado
│       │   └── scrapers/           # Utilidades de scraping
│       ├── types/                  # express.d.ts
│       ├── utils/                  # logger, hash, sanitize, fuzzy-match, geo, cors
│       ├── validators/             # 9 esquemas Zod
│       ├── workers/                # 3 workers BullMQ
│       ├── app.ts                  # Configuración Express
│       ├── server.ts               # Entrypoint servidor
│       ├── worker.ts               # Entrypoint worker standalone
│       └── sentry.ts               # Inicialización Sentry
│
├── vision/                         # Microservicio Python/FastAPI
│   ├── main.py                     # FastAPI (3 endpoints)
│   └── models/                     # Caffe age_net
│
├── .github/workflows/ci.yml        # CI/CD: build en push/PR a main
├── docker-compose.yml              # MongoDB 7, Redis 7, MinIO, API, Worker, Vision
├── AGENTS.md                       # Dispatch de instrucciones por área
├── DOCUMENTACION_BACK.md           # Documentación completa del backend (español)
├── DOCUMENTACION_FRONT.md          # Documentación completa del frontend (español)
└── README.md                       # Este archivo
```

---

## Autenticación y Seguridad

### Flujo de autenticación

1. **CSRF Token** — Al montar la app, `GET /api/auth/csrf-token` siembra cookie `csrf-token` (no httpOnly).
2. **Sesión persistente** — `GET /api/auth/me` restaura sesión si existe cookie httpOnly.
3. **Login** — Google OAuth (`POST /api/auth/google`) o email/password (`POST /api/auth/login`).
4. **JWT** — HS256, 7 días de expiración, cookie httpOnly + localStorage (doble canal).
5. **Token Version** — Cada JWT incluye `tokenVersion`. Al hacer logout o actualizar perfil, se incrementa invalidando sesiones anteriores.
6. **CSRF Protection** — Toda request mutante envía header `x-csrf-token`. Comparación con `timingSafeEqual`.
7. **Rate Limiting** — 500 req/15min global, 5-10 req/15min en auth.

### API Keys (Machine-to-Machine)

| Tipo | Header | Uso |
|---|---|---|
| admin | `x-api-key` | Endpoints `/api/admin` |
| webhook | `x-webhook-api-key` | Endpoints `/api/webhooks` |
| partner | `x-partner-api-key` | Endpoints `/api/partners` y `POST /api/localizados` |

Las API keys se almacenan como hash SHA-256 en MongoDB (modelo `ApiKey`).

### Roles de usuario

| Rol | Acceso |
|---|---|
| `user` | Reportar, buscar, ver feed/mapa |
| `verifier` | Periodistas/ONGs — pueden verificar reportes |
| `admin` | Panel completo, merge de perfiles, gestión de usuarios |

---

## Endpoints de la API

Todas las rutas bajo `/api`.

### Autenticación (`/api/auth`)

| Método | Ruta | Descripción | Rate Limit |
|---|---|---|---|
| GET | `/csrf-token` | Siembra cookie CSRF | — |
| POST | `/google` | Login Google OAuth | 5/15min |
| POST | `/register` | Registro email+password | 10/15min |
| POST | `/login` | Login email+password | 5/15min |
| GET | `/me` | Restaurar sesión | — |
| POST | `/profile` | Actualizar perfil | — |
| POST | `/logout` | Logout | — |

### Personas (`/api/persons`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/` | Público (paginado, ?q=, ?status=, ?category=, ?state=) |
| GET | `/counts` | Público (cacheado Redis 5min) |
| GET | `/mine` | Usuario |
| POST | `/` | Público (con dedup por idHash) |
| POST | `/:idHash/close` | Owner/Admin |

### Desastres (`/api/disasters`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/` | Público |
| GET | `/active` | Público |

### Búsqueda (`/api/search`)

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/vector` | Público (búsqueda semántica) |

### Contactos (`/api/contacts`)

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/send` | Usuario |
| GET | `/sent` | Usuario |
| GET | `/received` | Usuario |

### Solicitudes de Búsqueda (`/api/search-requests`)

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/` | Usuario |
| GET | `/mine` | Usuario |
| PATCH | `/:id/status` | Usuario |

### Media (`/api/media`)

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/` | Usuario (upload) |
| POST | `/analyze-image` | Usuario (análisis IA) |
| POST | `/audio-transcribe` | Usuario (Whisper) |

### Matches (`/api/matches`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/:reportId` | Usuario (owner) |

### CNE (`/api/cne`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/:nationality/:cedula` | Público |

### Partners (`/api/partners`)

| Método | Ruta | Auth |
|---|---|---|
| GET | `/cases` | Partner API Key |
| POST | `/cases` | Partner API Key |

### Webhooks (`/api/webhooks/n8n`)

| Método | Ruta | Auth |
|---|---|---|
| POST | `/whatsapp` | Webhook API Key |
| POST | `/telegram` | Webhook API Key |

### Localizados (`/api/localizados`)

| Método | Ruta | Auth |
|---|---|---|
| GET | `/` | Público |
| POST | `/` | Partner API Key |

### Administración (`/api/admin`)

Requiere `x-api-key` o JWT admin.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/persons` | Lista completa |
| PATCH | `/persons/:idHash/status` | Cambiar estado |
| PATCH | `/persons/:idHash/moderate` | Moderar |
| PUT | `/persons/:idHash` | Editar |
| POST | `/merge/:id1/:id2` | Fusionar perfiles |
| GET | `/audit` | Posibles duplicados |
| POST | `/audit/:jobId/merge` | Aprobar fusión |
| POST | `/audit/:jobId/dismiss` | Descartar fusión |
| GET | `/matches` | Todos los matches |
| PATCH | `/matches/:id/status` | Aprobar/rechazar match |
| GET | `/users` | Gestión usuarios |
| PATCH | `/users/:id/role` | Cambiar rol |
| PATCH | `/users/:id/status` | Aprobar/rechazar usuario |
| GET | `/verifications` | Solicitudes de verificación |
| GET | `/searches` | Historial búsquedas |
| GET | `/api-keys` | Listar API keys |
| POST | `/api-keys` | Crear API key |
| DELETE | `/api-keys/:id` | Revocar API key |
| GET | `/queues` | Bull Board UI |

---

## Workers y Colas (BullMQ)

| Cola | Worker | Propósito |
|---|---|---|
| `ia-process` | `ia-processor.worker.ts` | Procesa reportes con IA: extrae datos, genera embedding, reconcilia, notifica |
| `disaster-sync` | `disaster-sync.worker.ts` | Sincroniza 14 fuentes externas (scrapers) |
| `person-matching` | `matching.worker.ts` | Ejecuta matching vectorial + facial al crear/actualizar persona |
| `manual-audit` | (procesado por admin) | Auditoría humana de duplicados potenciales |

La aplicación puede ejecutarse en dos modos:
- **Monolito** (`RUN_WORKERS_IN_API=true`): Servidor HTTP + workers en el mismo proceso (desarrollo)
- **Separado** (`RUN_WORKERS_IN_API=false`): Workers en contenedor independiente (producción)

---

## Modelos de Datos (13 Modelos Mongoose)

| # | Modelo | Colección | Propósito |
|---|---|---|---|
| 1 | **UnifiedPerson** | `persons` | Personas desaparecidas/encontradas. Dedup por `idHash` SHA-256. |
| 2 | **User** | `users` | Usuarios con dual auth, roles, tokenVersion. |
| 3 | **Match** | `matches` | Coincidencias entre reportes con score y workflow. |
| 4 | **DisasterEvent** | `disaster_events` | Desastres con GeoJSON, severidad, metadatos por tipo. |
| 5 | **Localizado** | `localizados` | Personas en refugios/hospitales. |
| 6 | **SearchRequest** | `search_requests` | Solicitudes de búsqueda familiar con embedding. |
| 7 | **CaseContact** | `case_contacts` | Mensajes enmascarados (relé). |
| 8 | **ApiKey** | `api_keys` | API keys M2M (SHA-256). |
| 9 | **Outbox** | `outboxes` | Transactional Outbox (4 tipos de eventos). |
| 10 | **AuditLog** | `audit_logs` | Colección capped (1GB/1M docs). |
| 11 | **SyncState** | `sync_states` | Checksum MD5 para sincronización. |
| 12 | **StateHistory** | `state_histories` | Historial inmutable de cambios de estado. |
| 13 | **VerificationRequest** | `verification_requests` | Solicitudes de rol verifier. |

---

## Comandos de Desarrollo

### Frontend

```bash
cd front
npm run dev          # Desarrollo (HMR en localhost:5173)
npm run build        # Build producción (tsc -b + vite build)
npm run preview      # Preview de build
npm test             # Tests (Vitest)
npm run lint         # Oxlint
```

### Backend

```bash
cd back
npm run dev          # Desarrollo (tsx --watch)
npm run build        # Build producción (tsc)
npm start            # Iniciar servidor (compilado)
npm run worker       # Iniciar worker standalone
npm test             # Tests (Jest + ts-jest)
npm run lint         # Linter
npm run reconcile    # Reconciliación manual
```

### Infraestructura Local

```bash
docker compose up -d     # MongoDB + Redis + MinIO + Vision
docker compose logs -f   # Logs en vivo
docker compose down      # Detener todo
```

---

## Pruebas

```bash
# Frontend
cd front && npm test

# Backend
cd back && npm test
```

- **Frontend:** Vitest 4 + jsdom + @testing-library/react. Mocks de AuthContext, api, IntersectionObserver, react-leaflet.
- **Backend:** Jest 30 + ts-jest 29 + mongodb-memory-server (no necesita MongoDB real) + supertest + ioredis-mock.
- Los tests están excluidos del type-checking de compilación.

---

## Monitoreo y Observabilidad

| Herramienta | Dónde | Propósito |
|---|---|---|
| Sentry | front + back | Error tracking + performance + session replay |
| Bull Board | `/api/admin/queues` | UI de monitoreo de colas BullMQ |
| Pino | back | Logs estructurados con correlación distribuida |
| Health check | `GET /health` | Estado de MongoDB + Redis |
| Audit Log | MongoDB capped | Traza de acciones de administración |

---

## Convenios de Código

- **TypeScript estricto** — `strict: true`, `verbatimModuleSyntax`, `erasableSyntaxOnly` (no `enum`, no `namespace`).
- **Zod en toda entrada** — Middleware `validateBody`/`validateQuery`/`validateParams` en cada ruta.
- **Sin `any`** — Prohibido en source no-test. Usar tipos explícitos o `unknown`.
- **CSS plano** — Sin CSS-in-JS, sin Tailwind. Variables CSS globales para tema oscuro.
- **Documentación** — Cada archivo tiene header JSDoc con PROPÓSITO, CARACTERÍSTICAS, SEGURIDAD.
- **Idioma** — Código y documentación en español. Commits en inglés.
- **Sin commits directos a main** — PRs con conventional commits.
- **Seguridad primero** — Sanitizar toda entrada, redactar PII en logs, validar en backend.