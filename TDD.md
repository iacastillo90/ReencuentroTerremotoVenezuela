# Documento de Diseño Técnico (TDD)
**Proyecto:** Reencuentro Terremoto Venezuela
**Versión:** 2.0

---

## 1. Introducción y Contexto Arquitectónico

En situaciones de desastres naturales, la información ciudadana fluye de manera rápida pero caótica. El reto técnico de **Reencuentro Terremoto Venezuela** no es solo mostrar datos, sino **ingerir, limpiar, deduplicar y normalizar** reportes de personas desaparecidas provenientes de múltiples fuentes y presentarlos en una plataforma rápida, resiliente y de bajo consumo de datos.

Este documento detalla la arquitectura implementada, las decisiones tecnológicas tomadas y cómo el sistema garantiza alta disponibilidad, privacidad y operación offline.

---

## 2. Arquitectura de Alto Nivel

El sistema opera bajo un patrón de microservicios distribuidos utilizando tecnologías *Serverless* y *PaaS* para garantizar escalabilidad sin mantenimiento manual de servidores físicos.

### Componentes Core:
1. **Frontend (Vercel):**
   - **Stack:** React 19, TypeScript 6, Vite 8 (SWC).
   - **Estrategia:** SPA con lazy loading por vista. Estilos CSS planos con tema oscuro obligatorio. PWA con Service Worker personalizado.
2. **Backend API (Render):**
   - **Stack:** Node.js 22, Express 5, TypeScript 6.
   - **Estrategia:** REST API *stateless* con validación Zod en toda entrada, rate limiting, CSRF double-submit cookie, y JWT con tokenVersion.
3. **Worker Service (Render):**
   - **Stack:** Node.js, BullMQ 5.
   - **Estrategia:** Proceso dedicado a procesar colas (IA, matching, sincronización de desastres) sin bloquear la API principal.
4. **Almacenamiento Transaccional (MongoDB Atlas):**
   - **Estrategia:** Clúster NoSQL con Mongoose 9. Esquemas flexibles con índices Geoespaciales (`2dsphere`) y `idHash` único para deduplicación.
5. **Caché y Message Broker (Upstash Redis):**
   - **Estrategia:** Redis con auto-TLS para Upstash. Cacheo de respuestas API (`/persons/counts`) + backend de colas BullMQ.
6. **Almacenamiento de Medios (Supabase S3):**
   - **Estrategia:** Bucket S3-compatible vía MinIO client. Presigned URLs para upload/download.

---

## 3. Estructura de Datos Central

El corazón del sistema es el esquema `UnifiedPerson`. En lugar de tener tablas separadas por cada fuente externa, normalizamos todo en un único modelo.

### Schema `UnifiedPerson` (Mongoose)

```typescript
{
  // Identidad
  name: { type: String, required: true },
  normalizedName: { type: String }, // Lowercase sin acentos para búsquedas
  idHash: { type: String, unique: true }, // Crítico para deduplicación

  // Estado
  status: { type: String, enum: ['missing', 'found', 'deceased', 'unknown'] },
  lastSeen: {
    state: String,
    municipality: String,
    description: String,
    date: Date,
    coordinates: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number] // [longitud, latitud]
    }
  },

  // Perfil Demográfico
  age: Number,
  gender: String,
  description: String,
  photoUrl: String,

  // Metadatos (Privados)
  data: {
    cedula: String,
    origen: String,
    biometricHash: String  // Hash facial para matching biométrico
  },

  metadata: {
    urgencyScore: Number,
    createdAt: Date,
    updatedAt: Date
  }
}
```

---

## 4. Flujos de Trabajo (Workflows)

### 4.1. Ingesta y Deduplicación

Cuando el sistema obtiene datos masivos (ej. desde *VenezuelaReporta* mediante CRON jobs):

1. **Adapter** normaliza datos externos al schema interno (`back/src/adapters/`)
2. **Zod** valida tipos, longitudes, sanitiza HTML
3. **SyncState** calcula checksum MD5 para detectar cambios
4. **idHash** (SHA-256 de `source + externalId`) identifica únicamente cada registro
5. **Bulk Upsert** con `PersonModel.bulkWrite()` + `upsert: true`
6. **Workers** encolan matching y notificaciones

Flujo completo: Adapter → Zod → SyncState → idHash → Upsert → Workers

### 4.2. Procesamiento con Inteligencia Artificial

Cuando un usuario envía un reporte manual:
1. Texto libre → `POST /api/persons`
2. Encola en BullMQ `ia-process` (retorna 202 Accepted)
3. Worker `ia-processor.worker.ts` toma el mensaje
4. Proveedor IA configurable (Anthropic/OpenAI/Gemini) extrae JSON estructurado
5. Reconoce y consolida en `UnifiedPerson`
6. Genera embedding vectorial para búsqueda semántica (Pinecone)
7. Notifica vía Socket.IO

### 4.3. Offline Queue y BackgroundSync

Cuando un usuario crea un reporte sin conexión:

1. **ReportContext** detecta `navigator.onLine === false`
2. Guarda reporte + CSRF token en IndexedDB (`offlineReports` tabla)
3. Registra BackgroundSync (`sync-reports`) via Service Worker
4. **Service Worker** recibe `sync` event cuando hay conectividad
5. SW notifica a todos los clientes abiertos (`trigger-sync` message)
6. **useBackgroundSync hook** procesa la cola:
   - Lee reports `pending` de IndexedDB
   - Marca como `syncing`
   - Sube foto (POST /media)
   - Envía datos (POST /persons) con CSRF token almacenado
   - Elimina de IndexedDB en éxito
   - Reintenta hasta 3 veces en fallo, luego marca `failed`
7. Fallback: evento `online` del navegador si BackgroundSync no está disponible
8. `NetworkBadge` muestra estado de conexión y cantidad de pendientes

**Límite de reintentos:** 3 por reporte. Después de 3 fallos, se marca como `failed` para revisión manual.

### 4.4. Matching y Reconciliación

```
Persona nueva/actualizada → encola person-matching (BullMQ)
  → matcher.service → embedding + cosine similarity
  → Score > 95% → Auto-merge
  → Score > 85% → Encola manual-audit (revisión humana)
  → Score < 85% → No hace nada
```

---

## 5. Decisiones Técnicas y Justificaciones

| Decisión | Justificación |
|---|---|
| **React 19 + Vite 8** | Latest stable con SWC para builds rápidos. Compilador React no activado (control manual de memoización). |
| **TypeScript 6 estricto** | `strict: true`, `verbatimModuleSyntax`, `erasableSyntaxOnly`. Prohibido `any` en source no-test. |
| **Express 5** | Manejo nativo de async errors sin `express-async-errors`. |
| **Zod 4 en toda entrada** | Validación en capas: tipo, longitud, sanitización HTML (`sanitize-html`). Previene NoSQL injection + XSS. |
| **Pino (logs estructurados)** | Redacción automática de PII (passwords, tokens, cédulas, teléfonos, `error.config`). |
| **PWA con Service Worker personalizado** | Precaching de assets estáticos; estrategia StaleWhileRevalidate para API; offline fallback page; BackgroundSync. |
| **IndexedDB vía Dexie** | Almacenamiento offline de reportes con fotos. Sincronización automática al recuperar conexión. |
| **CSRF Bearer exemption** | Requests con `Authorization: Bearer` no necesitan CSRF (no son cookie-based). Habilita sync desde Service Worker y facilita clientes API. |
| **Página offline estática** | `offline.html` servida por el SW cuando no hay conexión. Incluye mensaje claro y botón de reintentar. No depende de React. |
| **CORS log sanitizado** | El log de orígenes rechazados ya no incluye la lista `allowedOrigins` (exponía infraestructura interna). Solo registra `origin`. |
| **Content Security Policy (report-only)** | Endpoint `POST /api/csp-report` recibe reportes de violaciones. No bloquea recursos — solo monitorea. Activable modo enforce con `CSP_ENFORCE=true`. |
| **safeRegexQuery** | Previene ReDoS en búsquedas `$regex` escapando metacaracteres. |
| **Redis URL redaction** | Error handler sanitiza `redis://***@host:port` antes de loguear. |
| **Split de servicios** | `person.service.ts` dividido en `person.service.ts` (mutaciones) + `person-read.service.ts` (consultas). Misma división para auth controller. |
| **Infinite scroll con IntersectionObserver** | Feed de personas con carga paginada (50 items) + debounce de 500ms en búsqueda. Reduce payload inicial y consumo de datos móviles. |
| **Lazy loading de vistas** | 13 páginas cargadas con `React.lazy` + `Suspense`. El chunk de la vista Home (~30KB) se carga primero; el resto bajo demanda. |
| **Oxlint sobre ESLint** | Linter 50x más rápido que ESLint. Plugins `react` + `typescript` + `oxc`. Sin Prettier (formateo manual). |
| **Vitest sobre Jest** | 3x más rápido en modo watch. Compatibilidad nativa con Vite. `jsdom` para tests de componentes. |
| **Prohibición de `any`** | TypeScript estricto: `strict: true`, `erasableSyntaxOnly: true`. `any` prohibido en source no-test (oxlint rule `no-explicit-any`). Enforcing con `@typescript-eslint/no-explicit-any` + code review. |
| **CSS plano sobre CSS-in-JS** | Sin Tailwind, sin styled-components. Variables CSS globales para tema oscuro. Archivos `.css` por componente. 18 inline styles migrados a CSS classes. |
| **Store offline en IndexedDB** | Reportes sin conexión guardados con CSRF token + foto (blob). Sincronización automática con BackgroundSync API + fallback evento `online`. Máximo 3 reintentos por reporte. |

---

## 6. Seguridad (Defense in Depth)

| Capa | Descripción |
|---|---|
| **Zod validation** | Toda entrada pasa por `validateBody/validateQuery/validateParams`. Strings sanitizados con `sanitize-html`. |
| **CSRF double-submit** | Cookie `csrf-token` + header `x-csrf-token`. Comparación con `timingSafeEqual`. Exento para Bearer token y API keys. |
| **Rate limiting** | Global (500 req/15min) + específico por endpoint auth (5-10 req/15min). |
| **JWT con tokenVersion** | Cada JWT incluye `tokenVersion`. Logout/profile update incrementa → invalida sesión. |
| **Password hashing** | `scrypt` nativo (Node.js) con salt de 16 bytes + hash de 64 bytes. Campo `select: false` en Mongoose. |
| **API keys** | SHA-256 hash en DB. Soporte legacy via env vars con `timingSafeEqual`. |
| **Audit log** | Colección capped (1GB/1M docs) para acciones admin. |
| **PII redaction** | Pino redacta: `authorization`, `cookie`, `password`, `token`, `cedula`, `contactNumber`, `phone`, `error.config`. |
| **CORS restrictivo** | Lista blanca con coincidencia subdominio a subdominio. No logging de orígenes permitidos. |
| **NoSQL injection** | `String()` coercion + `safeRegexQuery` en toda construcción de filtros `$regex`. |
| **Proyección Mongoose** | Campos sensibles excluidos en queries vía `toPublicPerson()`. |

---

## 7. Service Worker y Estrategia PWA

### Service Worker Personalizado (`front/src/sw.ts`)

El SW se inyecta via `vite-plugin-pwa` con estrategia `injectManifest`. Compilado por Vite como entrypoint separado.

**Responsabilidades:**
1. **Precaching**: Assets estáticos (JS, CSS, HTML, imágenes) en caché `static-v1`
2. **API Runtime Cache**: Respuestas `/api/*` con StaleWhileRevalidate en caché `api-cache`
3. **BackgroundSync**: Escucha evento `sync` con tag `sync-reports`, notifica a clientes
4. **Offline Fallback**: Sirve `/offline.html` para navegaciones cuando no hay conexión
5. **Message Passing**: Comunica estado de sincronización con la aplicación (`trigger-sync`, `pending-count`, `skip-waiting`)

### IndexedDB Schema (`ReencuentroDB`)

```
offlineReports (version 2):
  ├── id:          auto-increment (primary key)
  ├── reportData:  JSON con datos del reporte
  ├── photoFile:   Blob (opcional)
  ├── csrfToken:   Token CSRF para autenticar el sync
  ├── status:      'pending' | 'syncing' | 'failed'
  ├── retryCount:  Número de reintentos (max 3)
  └── createdAt:   Timestamp UNIX
```

### Flujo Offline

```
Usuario offline → crea reporte → ReportContext
  → IndexedDB.add({ status: 'pending', csrfToken, ... })
  → navigator.serviceWorker.sync.register('sync-reports')

... tiempo pasa, conexión retorna ...

Service Worker → sync event
  → postMessage({ type: 'trigger-sync' }) a todos los clients
  ➜ (si no hay client, se reintenta en el próximo ciclo)

O bien:
Browser → 'online' event
  → registerBackgroundSync() (si soportado)
  → syncOfflineReports() (fallback directo)

syncOfflineReports():
  → for each pending report:
    → status = 'syncing'
    → upload photo (POST /media)
    → POST /persons (con CSRF token almacenado)
    → delete from IndexedDB (éxito)
    → retry++ (fallo, max 3)
```

---

## 8. Estructura del Backend (refinada)

```
back/src/
├── adapters/          # ISourceAdapter para normalizar fuentes externas (6 adapters)
├── config/            # Redis (ioredis + auto-TLS + URL sanitization en logs)
├── controllers/       # Express handlers (separados: auth.controller + auth-profile.controller)
├── database/          # Conexión MongoDB
├── jobs/              # Scrapers node-cron (12 fuentes: USGS, FIRMS, FUNVISIS, etc.)
├── middlewares/       # Auth, CSRF (con Bearer exemption), Audit, Error, Validate, Correlation
├── models/            # Mongoose (13 modelos: UnifiedPerson, User, Localizado, Match, etc.)
├── queues/            # BullMQ (4 colas: ia-process, disaster-sync, manual-audit, person-matching)
├── routes/            # Express routers (13 archivos)
├── services/          # Lógica de negocio
│   ├── admin/         # Person, User, Match, Audit, Search admin services
│   ├── ai/            # Anthropic / OpenAI / Gemini providers (factory pattern)
│   ├── legacy/        # Bridge SQL heredado
│   └── scrapers/      # Scraping services
├── types/             # TypeScript declarations
├── utils/             # Logger (Pino), hash, sanitize (Zod + sanitize-html), regex-escape, cors, jwt, password (scrypt)
├── validators/        # Zod schemas (9 archivos)
├── workers/           # BullMQ workers (3: IA processor, disaster sync, matching)
├── app.ts             # Express config + rutas
├── server.ts          # Bootstrap servidor
├── worker.ts          # Bootstrap worker standalone
└── sentry.ts          # Inicialización Sentry
```

---

## 9. Estructura del Frontend (refinada)

```
front/src/
├── __tests__/         # Tests (App, Auth, AuthModal, vite config)
├── components/
│   ├── common/        # NetworkBadge, Skeleton, ChatWidget, ModalOverlay, etc.
│   ├── map/           # InteractiveMap, MapFilters, MapLegend
│   ├── modals/        # PersonDetailModal, ReportModal, AuthModal, AudioRecorder
│   └── ui/            # Button, Input (design system)
├── db/                # IndexedDB (Dexie) — offlineReports table
├── hooks/             # useBackgroundSync, useNetworkStatus, usePersons, useBackgroundSync
├── layouts/           # AppLayout + MobileBottomNav
├── pages/             # 13 vistas lazy-loaded (Home, Feed, Search, Map, Admin, Profile, etc.)
├── services/          # api.ts (Axios + CSRF interceptor + offline support)
├── store/             # AuthContext, SocketContext, ToastContext
├── types/             # Person, Disaster, SearchRequest interfaces
├── utils/             # sync-utils (BackgroundSync registration + SW messaging)
├── sw.ts              # Service Worker personalizado (injectManifest)
├── App.tsx            # State-based router (useState<View>)
└── main.tsx           # Entrypoint
```

---

## 10. Comandos de Desarrollo

### Frontend
```bash
cd front
npm run dev       # Desarrollo (localhost:5173, Vite proxy → backend)
npm run build     # tsc -b + vite build (incluye build del SW)
npm test          # Vitest + jsdom
npm run lint      # Oxlint
```

### Backend
```bash
cd back
npm run dev       # tsx --watch
npm run build     # tsc
npm start         # node dist/src/server.js
npm run worker    # node dist/src/worker.js
npm test          # Vitest
npm run lint      # Linter
```

### Infraestructura local
```bash
docker compose up -d   # MongoDB + Redis + MinIO
```

---

## 11. Privacidad y Cumplimiento (Privacy by Design)

1. **Proyección segura de Mongoose:** Campos PII (`contactNumber`, `email`, etc.) nunca enviados al frontend.
2. **Prevención de scraping:** Paginación con `limit <= 200` y rate limiting global.
3. **Ofuscación geográfica:** Coordenadas a nivel macro (estado/ciudad), no exactas.
4. **Contacto enmascarado:** Mensajes entre usuarios pasan por el servidor sin revelar datos de contacto.
5. **PII redaction en logs:** Pino redacta automáticamente passwords, tokens, cédulas, teléfonos.
6. **Cierre de caso con sello legal:** Timestamp + IP + resolución sellados criptográficamente.
7. **Almacenamiento local efímero:** Reportes offline en IndexedDB se eliminan tras sincronización exitosa.

---

## 12. Integraciones Externas

| Integración | Tipo | Propósito |
|---|---|---|
| Google OAuth | Auth | Login social vía `@react-oauth/google` |
| Google AI / OpenAI / Anthropic | IA | Procesamiento de texto libre |
| Pinecone | Vector DB | Búsqueda semántica por embedding |
| Supabase Storage / MinIO | Storage | Fotos y archivos de reportes |
| Upstash Redis | Cache/Queue | Caché de counts + colas BullMQ |
| n8n webhooks | Ingesta | WhatsApp + Telegram |
| Partners API | API Key | ONGs y gobierno |
| USGS, FIRMS, GDACS, FUNVISIS, etc. | Scrapers | 12 fuentes de datos de desastres |
| CNE Venezuela | API | Consulta de cédula |

---

*Fin del Documento de Diseño Técnico (v2.0)*
