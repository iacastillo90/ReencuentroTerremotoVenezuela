# Guía Técnica para Desarrolladores (Developer Hub)
**Proyecto:** Reencuentro Terremoto Venezuela

Este documento es una referencia técnica integral para ingenieros que se integran al proyecto. Cubre arquitectura, stack, endpoints, seguridad, flujos de autenticación y comandos de desarrollo.

---

## Agente IA (AGENTS.md)

El proyecto usa un sistema de instrucciones por área. **Siempre lee el sub-archivo antes de editar código en ese directorio:**

| Área | Archivo |
|---|---|
| Backend | `back/AGENTS.md` |
| Frontend | `front/AGENTS.md` |
| Visión/ML | `vision/AGENTS.md` |

---

## Stack Tecnológico

### Frontend (`front/`)
- **Core:** React 19, TypeScript 6, Vite 8 (SWC)
- **Routing:** react-router-dom 7 (SPA, ruteo por estado `useState<View>`, sin URLs)
- **Estilos:** CSS plano con variables CSS globales (tema oscuro obligatorio)
- **Mapas:** Leaflet + react-leaflet 5 + react-leaflet-cluster
- **Iconos:** Lucide React
- **Auth:** Google OAuth (`@react-oauth/google`) + email/password + JWT
- **HTTP:** Axios con CSRF double-submit interceptor automático
- **PWA:** `vite-plugin-pwa` con `StaleWhileRevalidate` para `/api/`
- **Linter:** Oxlint (no ESLint, no Prettier)
- **Tests:** Vitest 4 + jsdom + @testing-library/react
- **Despliegue:** Vercel (SPA con fallback a `index.html`)

### Backend (`back/`)
- **Core:** Node.js 22, Express 5, TypeScript 6 (CommonJS)
- **Base de Datos:** MongoDB (Mongoose 9 ODM)
- **Caché y Colas:** Redis (ioredis) + BullMQ 5
- **Validación:** Zod 4 — toda entrada pasa por esquemas estrictos
- **IA:** Anthropic SDK / OpenAI SDK (seleccionable por `AI_PROVIDER`)
- **Almacenamiento:** Cliente MinIO (compatible Supabase Storage / S3)
- **Auth:** `jsonwebtoken` (HS256), `google-auth-library`, `scrypt` (passwords)
- **Logs:** Pino (estructurado, con redacción automática de PII)
- **Tests:** Vitest 4
- **Despliegue:** Render (Web Service + Background Worker)

---

## Estructura del Repositorio

```
ReencuentroTerremotoVenezuela/
├── front/                          # SPA — React 19 + Vite 8
│   ├── src/
│   │   ├── __tests__/              # Tests (App, Auth, AuthModal, vite config)
│   │   ├── assets/                 # Recursos estáticos
│   │   ├── components/
│   │   │   ├── common/             # UI reutilizable (Skeleton, ChatWidget, etc.)
│   │   │   ├── map/                # Mapa Leaflet (InteractiveMap, MapFilters, MapLegend)
│   │   │   ├── modals/             # Modales (PersonDetail, Report, Auth)
│   │   │   └── ui/                 # Design system (Button, Input)
│   │   ├── data/                   # Datos estáticos (library.json)
│   │   ├── db/                     # IndexedDB offline (Dexie)
│   │   ├── hooks/                  # Custom hooks (usePersons, useBackgroundSync)
│   │   ├── layouts/                # AppLayout, MobileBottomNav
│   │   ├── pages/
│   │   │   ├── Admin/              # Dashboard admin (6 secciones)
│   │   │   ├── Auth/               # Login, Register
│   │   │   ├── Feed/               # Infinite scroll + FeedCard
│   │   │   ├── Home/               # HomePage + HomeGateway (public landing)
│   │   │   ├── Library/            # Directorio de recursos
│   │   │   ├── Logistics/          # Alertas logísticas
│   │   │   ├── Manual/             # Guías éticas y políticas
│   │   │   ├── Map/                # Mapa interactivo
│   │   │   ├── Profile/            # Perfil (tabs: Reports, Matches, Chats)
│   │   │   ├── Search/             # Búsqueda normal + IA vectorial
│   │   │   └── Directory/          # Organizaciones verificadas
│   │   ├── services/               # api.ts (Axios + CSRF interceptor)
│   │   ├── store/                  # React Contexts (Auth, Socket, Toast)
│   │   ├── types/                  # Interfaces (Person, Disaster, etc.)
│   │   └── utils/                  # humanizeError, sanitize
│   └── package.json
│
├── back/                           # API REST + Workers asíncronos
│   ├── scripts/                    # Mantenimiento y despliegue
│   └── src/
│       ├── __tests__/              # Tests
│       ├── adapters/               # Normalizadores de fuentes externas
│       ├── config/                 # Redis (ioredis)
│       ├── controllers/            # Handlers Express (thin layer)
│       ├── database/               # Conexión MongoDB
│       ├── jobs/                   # Scrapers cron (12 fuentes)
│       ├── middlewares/            # Auth, CSRF, Audit, Error, Validate, Correlation
│       ├── models/                 # Mongoose schemas (13 modelos)
│       ├── queues/                 # BullMQ (4 colas)
│       ├── routes/                 # Routers Express (13 archivos)
│       ├── services/               # Lógica de negocio
│       │   ├── admin/              # Servicios de administración
│       │   ├── ai/                 # Proveedores IA (Anthropic, OpenAI, Gemini)
│       │   ├── legacy/             # Bridge SQL heredado
│       │   └── scrapers/           # Scrapers de fuentes
│       ├── types/                  # TypeScript declarations
│       ├── utils/                  # Logger, hash, sanitize, geo, regex-escape, etc.
│       ├── validators/             # Esquemas Zod (9 archivos)
│       ├── workers/                # Consumidores BullMQ (3 workers)
│       ├── app.ts                  # Configuración Express
│       ├── server.ts               # Entrypoint servidor
│       ├── worker.ts               # Entrypoint worker standalone
│       └── sentry.ts               # Inicialización Sentry
│
├── .github/                        # GitHub Actions
├── docker-compose.yml              # Infraestructura local (Mongo, Redis, MinIO)
├── AGENTS.md                       # Dispatch de instrucciones por área
└── DEVELOPERS.md                   # Este archivo
```

---

## Autenticación y Seguridad

### Flujo de Autenticación

1. **CSRF Token** — Al montar la app, `GET /api/auth/csrf-token` siembra cookie `csrf-token` (no httpOnly).
2. **Sesión persistente** — `GET /api/auth/me` restaura sesión si existe cookie httpOnly `token`.
3. **Login** — Google OAuth (`POST /api/auth/google`) o email/password (`POST /api/auth/login`).
4. **JWT** — HS256, 7 días de expiración, enviado como cookie httpOnly + en body.
5. **Token Version** — Cada JWT incluye `tokenVersion`. Al hacer logout o actualizar perfil, se incrementa (`$inc: 1`), invalidando sesiones anteriores.
6. **CSRF Protection** — Toda request mutante envía header `x-csrf-token` leído de cookie. Comparación con `timingSafeEqual`.
7. **Rate Limiting** — 3 limitadores independientes por endpoint auth (configurable vía env vars).

### Roles

| Rol | Acceso |
|---|---|
| `user` | Reportar, buscar, ver feed/mapa. Estado inicial: `pending` (requiere aprobación). |
| `verifier` | Periodistas/ONGs — pueden verificar reportes. |
| `admin` | Panel completo, cambio de estados, merge de perfiles, gestión de usuarios. |

### API Keys (Machine-to-Machine)

| Tipo | Header | Uso |
|---|---|---|
| `admin` | `x-api-key` | Endpoints `/api/admin` |
| `webhook` | `x-webhook-api-key` | Endpoints `/api/webhooks` |
| `partner` | `x-partner-api-key` | Endpoints `/api/partners` y `/api/localizados` POST |

Las API keys se almacenan como hash SHA-256 en MongoDB, con soporte legacy via env vars.

### Capas de Seguridad

1. **Zod** — Validación estricta de toda entrada (tipos, longitudes, sanitización HTML).
2. **sanitize-html** — Stripea etiquetas HTML de todo input de texto (`allowedTags: []`).
3. **safeRegexQuery** — Escapa metacaracteres regex para prevenir ReDoS en búsquedas `$regex`.
4. **CORS** — Lista blanca de orígenes con coincidencia estricta (subdominio a subdominio).
5. **CSRF** — Double-submit cookie pattern con tokens de 256 bits.
6. **Rate Limiting** — Global (500 req/15min) + específico por endpoint auth.
7. **Password Hashing** — `scrypt` nativo (Node.js) con salt de 16 bytes + hash de 64 bytes.
8. **PII Redaction** — Pino redacta automáticamente: passwords, tokens, cédulas, teléfonos, `error.config` en logs.
9. **Audit Log** — Colección capped (1GB/1M docs) con registro de acciones de admin.
10. **Content Security Policy** — Report-only CSP endpoint (`POST /api/csp-report`).

---

## API Endpoints Principales

Todas las rutas bajo `/api`.

### Autenticación (`/api/auth`)

| Método | Endpoint | Descripción | Rate Limit |
|---|---|---|---|
| `GET` | `/csrf-token` | Siembra cookie CSRF y devuelve token | — |
| `POST` | `/google` | Login con Google OAuth credential | 5/15min |
| `POST` | `/register` | Registro email+password | 10/15min |
| `POST` | `/login` | Login email+password | 5/15min |
| `GET` | `/me` | Obtener usuario actual (restaurar sesión) | — |
| `POST` | `/profile` | Actualizar perfil (incrementa tokenVersion) | — |
| `POST` | `/logout` | Logout (incrementa tokenVersion) | — |

### Personas (`/api/persons`)

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| `GET` | `/` | Lista paginada con búsqueda difusa (`?q=`), filtros (`?status=`, `?category=`, `?state=`, `?municipality=`) | Público |
| `GET` | `/counts` | Estadísticas (desaparecidos/encontrados), cacheado Redis TTL 5min | Público |
| `GET` | `/mine` | Mis reportes (requiere sesión) | Usuario |
| `POST` | `/` | Crear reporte de persona (con dedup por idHash) | Público |
| `POST` | `/:idHash/close` | Cerrar caso con resolución (found/deceased/erroneous) + sello legal (timestamp+IP) | Owner/Admin |

### Localizados (`/api/localizados`)

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| `GET` | `/` | Personas localizadas en refugios/hospitales (búsqueda por nombre/cédula/ubicación) | Público |
| `POST` | `/` | Inserción masiva de localizados (ordered:false, tolera duplicados) | Partner |

### Búsqueda (`/api/search`)

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| `POST` | `/vector` | Búsqueda por similitud semántica (texto libre → embedding → cosine similarity) | Público |

### Contactos (`/api/contacts`)

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| `POST` | `/` | Enviar mensaje enmascarado al reportante | Usuario |
| `GET` | `/sent` | Mensajes enviados | Usuario |
| `GET` | `/received` | Mensajes recibidos | Usuario |

### Solicitudes de Búsqueda (`/api/search-requests`)

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| `POST` | `/` | Crear solicitud de búsqueda familiar | Usuario |
| `GET` | `/mine` | Mis solicitudes | Usuario |
| `PATCH` | `/:id/status` | Actualizar estado de solicitud | Usuario |

### Desastres (`/api/disasters`)

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| `GET` | `/` | Todos los eventos de desastre | Público |
| `GET` | `/active` | Eventos activos/recientes | Público |

### CNE (`/api/cne`)

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| `GET` | `/:nationality/:cedula` | Consulta de cédula (CNE) | Público |

### Media (`/api/media`)

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| `POST` | `/` | Subir archivo multimedia | Usuario |
| `POST` | `/analyze-image` | Análisis de imagen con IA | Usuario |
| `POST` | `/audio-transcribe` | Transcripción de audio (Whisper) | Usuario |

### Partners (`/api/partners`)

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| `GET` | `/cases` | Listar casos de partner | Partner API Key |
| `POST` | `/cases` | Crear caso desde partner | Partner API Key |

### Webhooks (`/api/webhooks`)

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| `POST` | `/n8n/whatsapp` | Webhook WhatsApp desde n8n | Webhook API Key |
| `POST` | `/n8n/telegram` | Webhook Telegram desde n8n | Webhook API Key |

### Matches (`/api/matches`)

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| `GET` | `/:reportId` | Matches de IA para un reporte | Usuario (owner) |

### Administración (`/api/admin`)

Requiere `x-api-key` o JWT admin. Endpoints principales:

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/persons` | Lista completa de personas |
| `PATCH` | `/persons/:idHash/status` | Cambiar estado |
| `PATCH` | `/persons/:idHash/moderate` | Moderar reporte |
| `PUT` | `/persons/:idHash` | Editar persona |
| `GET` | `/persons/:idHash/contacts` | Mensajes de un reporte |
| `POST` | `/merge/:id1/:id2` | Fusionar perfiles duplicados |
| `GET` | `/audit` | Posibles duplicados para revisión |
| `POST` | `/audit/:jobId/merge` | Aprobar merge de auditoría |
| `POST` | `/audit/:jobId/dismiss` | Descartar merge de auditoría |
| `GET` | `/matches` | Todos los matches de IA |
| `PATCH` | `/matches/:id/status` | Aprobar/rechazar match |
| `GET` | `/users` | Gestión de usuarios |
| `PATCH` | `/users/:id/role` | Cambiar rol |
| `PATCH` | `/users/:id/status` | Aprobar/rechazar usuario |
| `GET` | `/verifications` | Solicitudes de verificación |
| `GET` | `/searches` | Historial de búsquedas |
| `POST` | `/api-keys` | Crear API key |
| `GET` | `/api-keys` | Listar API keys |
| `DELETE` | `/api-keys/:id` | Revocar API key |
| `GET` | `/queues` | Bull Board UI (monitoreo de colas) |

---

## Workers y Colas (BullMQ)

Arquitectura de procesamiento asíncrono con Redis:

| Cola | Worker | Propósito |
|---|---|---|
| `ia-process` | `ia-processor.worker.ts` | Procesa reportes con IA: extrae datos estructurados, genera embedding, reconcilia, notifica vía Socket.IO |
| `disaster-sync` | `disaster-sync.worker.ts` | Sincroniza datos de 10+ fuentes externas (USGS, FIRMS, FUNVISIS, INAMEH, etc.) |
| `person-matching` | `matching.worker.ts` | Ejecuta matching engine al crear/actualizar persona (cosine similarity + vector search) |
| `manual-audit` | _(procesado por admin)_ | Auditoría manual de duplicados potenciales |

La aplicación puede ejecutarse en dos modos:
- **Monolito** (`server.ts`): Servidor HTTP + workers en el mismo proceso (dev).
- **Separado** (`worker.ts`): Solo workers, sin HTTP (producción en Render Background Worker).

---

## Comandos de Desarrollo

### Frontend

```bash
cd front
npm run dev          # Desarrollo (HMR en localhost:5173)
npm run build        # Build producción (tsc -b + vite build)
npm run preview      # Preview de build
npm test             # Tests (Vitest)
npm run lint         # Linter (Oxlint)
```

### Backend

```bash
cd back
npm run dev          # Desarrollo con tsx --watch
npm run build        # Build producción (tsc)
npm start            # Iniciar servidor (compilado)
npm run worker       # Iniciar worker standalone
npm test             # Tests (Vitest)
npm run lint         # Linter
```

### Infraestructura Local

```bash
docker compose up -d   # MongoDB, Redis, MinIO
```

---

## Entidades de Base de Datos (Modelos — 13)

| Modelo | Colección | Propósito |
|---|---|---|
| `UnifiedPerson` | `persons` | Entidad principal. Dedup por `idHash` criptográfico. Soporta GeoJSON, embeddings, múltiples `externalIds`. |
| `DisasterEvent` | `disaster_events` | Eventos de desastre con coordenadas GeoJSON, severidad, tipo, fuente. |
| `Match` | `matches` | Resultados de matching entre personas con score y estado de revisión. |
| `User` | `users` | Usuarios con dual auth (Google OAuth + email/password), roles, `tokenVersion`. |
| `ApiKey` | `api_keys` | API keys con hash SHA-256 para admin/webhook/partner. |
| `Localizado` | `localizados` | Personas localizadas en refugios/hospitales. |
| `CaseContact` | `case_contacts` | Mensajes entre usuarios sobre reportes (contacto enmascarado). |
| `SearchRequest` | `search_requests` | Solicitudes de búsqueda familiar con embedding para matching vectorial. |
| `Outbox` | `outboxes` | Patrón Transactional Outbox (matching, auditoría, IA, geo-enrich). |
| `AuditLog` | `audit_logs` | Colección capped (1GB/1M docs) para auditoría de acciones admin. |
| `SyncState` | `sync_states` | Tracking de dedup por fuente + externalId con checksum MD5. |
| `StateHistory` | `state_histories` | Historial inmutable de cambios de estado de personas. |
| `VerificationRequest` | `verification_requests` | Solicitudes para convertirse en verifier (moderador). |

---

## Características Clave del Frontend

- **Ruteo por estado** — `App.tsx` usa `useState<View>` con 13 vistas, sin URLs. Lazy loading con `React.lazy` + `Suspense`.
- **PWA** — Service worker con `StaleWhileRevalidate` para calls `/api/`. Cacheo de 5 minutos.
- **Offline** — Reportes offline se guardan en IndexedDB (Dexie) y se sincronizan al recuperar conexión.
- **CSRF automático** — Interceptor de Axios lee cookie `csrf-token`, la envía como header, y auto-refresca en 403.
- **Tema oscuro** — Obligatorio. Variables CSS globales en `index.css`.
- **Mapa** — Leaflet con MarkerCluster, filtros por capa (personas, sismos, incendios, inundaciones, sociales).
- **Feed** — Infinite scroll con `IntersectionObserver`, chips de filtro, búsqueda con debounce de 500ms.
- **Reporte multi-step** — Wizard con 7 pasos: categoría → voz (AI assist) → características → vestimenta → señas → ubicación → éxito.
- **Contacto enmascarado** — Los mensajes entre usuarios pasan por el servidor, que reenvía sin revelar datos de contacto.

---

## Pruebas

```bash
# Frontend
cd front && npm test

# Backend
cd back && npm test
```

- Frontend: Vitest + jsdom. Mocks de `AuthContext`, `api`, `IntersectionObserver`, `react-leaflet`.
- Backend: Vitest.
- Los tests están excluidos del type-checking de compilación.

---

## Feature Flags y Variables de Entorno

### Frontend (`.env`)
```
VITE_API_URL=http://localhost:4000/api
VITE_GOOGLE_CLIENT_ID=...
```

### Backend (`.env`)
```
NODE_ENV=development|production|test
PORT=4000
MONGODB_URI=mongodb://localhost:27017/reencuentro
REDIS_URL=redis://localhost:6379
JWT_SECRET=...
ADMIN_API_KEY=...
WEBHOOK_API_KEY=...
PARTNER_API_KEY=...
AI_PROVIDER=anthropic|openai|gemini
CORS_ORIGINS=http://localhost:5173,http://localhost:4000
GLOBAL_RATE_LIMIT=500
AUTH_RATE_LIMIT=5
LOGIN_RATE_LIMIT=5
REGISTER_RATE_LIMIT=10
DEV_MODE=true|false
```

---

## Flujo de Datos: Reporte → Persona Unificada

1. **Usuario/envía formulario** → `POST /api/persons` (Zod valida payload)
2. **Controller** → `person.service.upsertPerson()` — genera `idHash` criptográfico, busca duplicado por `externalIds`
3. **Si no existe** → Crea `UnifiedPerson` + encola `person-matching` (BullMQ)
4. **Worker matching** → `matcher.service.runMatchingForNewPerson()` — calcula embedding, busca similares en Pinecone, crea `Match` entries
5. **Si score > 95%** → Auto-merge vía `reconciliation.service`
6. **Si score > 85%** → Encola `manual-audit` para revisión humana
7. **Socket.IO** → Notifica al admin en tiempo real si hay nuevos matches pendientes

---

## Convenios de Código

- **TypeScript estricto** — `strict: true`, `verbatimModuleSyntax`, `erasableSyntaxOnly` (no `enum`, no `namespace`).
- **Zod en toda entrada** — `validateBody/validateQuery/validateParams` middleware en cada ruta.
- **Sin `any`** — Prohibido en source no-test. Usar tipos explícitos o `unknown`.
- **CSS plano** — Sin CSS-in-JS, sin Tailwind. Variables CSS globales para tema oscuro.
- **Sin commits directos a main** — PRs con conventional commits.
- **Documentación** — Cada archivo tiene header JSDoc con PROPÓSITO, CARACTERÍSTICAS, SEGURIDAD.
- **Seguridad primero** — Sanitizar toda entrada, redactar PII en logs, validar en backend.
