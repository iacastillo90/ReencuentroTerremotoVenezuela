# Documentación del Backend — Reencuentro Terremoto Venezuela

> **Idioma:** Español · **Tono:** Técnico con sensibilidad humana · **Audiencia:** Desarrolladores, arquitectos, colaboradores del proyecto

---

## Índice

1. [¿Qué es este backend?](#1-qué-es-este-backend)
2. [Estructura del paquete](#2-estructura-del-paquete)
3. [Punto de entrada: server.ts](#3-punto-de-entrada-serverts)
4. [Configuración de Express: app.ts](#4-configuración-de-express-appts)
5. [Modelos de datos (Mongoose)](#5-modelos-de-datos-mongoose)
6. [Rutas y controladores](#6-rutas-y-controladores)
7. [Servicios: el corazón de la lógica](#7-servicios-el-corazón-de-la-lógica)
8. [Adaptadores: normalización de fuentes externas](#8-adaptadores-normalización-de-fuentes-externas)
9. [Scrapers y jobs programados](#9-scrapers-y-jobs-programados)
10. [Workers BullMQ: procesamiento asíncrono](#10-workers-bullmq-procesamiento-asíncrono)
11. [Transactional Outbox: garantía de entrega](#11-transactional-outbox-garantía-de-entrega)
12. [Middlewares: seguridad y trazabilidad](#12-middlewares-seguridad-y-trazabilidad)
13. [Validadores Zod](#13-validadores-zod)
14. [Servicio de Matching](#14-servicio-de-matching)
15. [Múltiples proveedores de IA](#15-múltiples-proveedores-de-ia)
16. [Almacenamiento y archivos multimedia](#16-almacenamiento-y-archivos-multimedia)
17. [Socket.IO: notificaciones en tiempo real](#17-socketio-notificaciones-en-tiempo-real)
18. [Monitoreo: Sentry y Bull Board](#18-monitoreo-sentry-y-bull-board)
19. [Seguridad integral](#19-seguridad-integral)
20. [Docker y despliegue](#20-docker-y-despliegue)

---

## 1. ¿Qué es este backend?

Este backend es el **sistema nervioso central** de la plataforma Reencuentro Terremoto Venezuela. Su misión es recibir, limpiar, deduplicar y centralizar reportes de personas desaparecidas durante desastres naturales en Venezuela, para que familiares, rescatistas y organismos puedan encontrar a sus seres queridos.

No es una API tradicional. Es un **motor de ingesta, procesamiento y reconciliación** que:

- Recibe datos de 14 fuentes distintas (gubernamentales, internacionales, ONGs, WhatsApp, Telegram)
- Los normaliza a un esquema único
- Los deduplica criptográficamente (SHA-256)
- Los enriquece con inteligencia artificial
- Los empareja con solicitudes de búsqueda de familias
- Todo con privacidad por diseño y protección de menores

Está escrito en **Node.js 22 + Express 5 + TypeScript 6**, con **MongoDB 7** como base de datos, **Redis 7** para caché y colas, **BullMQ 5** para procesamiento asíncrono, y **Zod 4** para validación.

---

## 2. Estructura del paquete

```
back/
├── src/
│   ├── adapters/          # Normalizadores de cada fuente externa
│   ├── config/            # Configuración (Redis con auto-TLS para Upstash)
│   ├── controllers/       # Handlers HTTP (capa delgada, delegan a servicios)
│   ├── database/          # Conexión a MongoDB (Mongoose)
│   ├── jobs/              # 14 scrapers/cron jobs
│   ├── middlewares/       # Seguridad, auth, CSRF, logging, errores
│   ├── models/            # 13 esquemas Mongoose
│   ├── queues/            # Definiciones de colas BullMQ
│   ├── routes/            # 13 routers Express
│   ├── services/          # Lógica de negocio (~27 servicios)
│   │   ├── admin/         # Servicios administrativos
│   │   ├── ai/            # Proveedores de IA (factory pattern)
│   │   └── scrapers/      # Utilidades de scraping
│   ├── types/             # Tipos personalizados
│   ├── utils/             # Utilidades (hash, fuzzy match, logger, etc.)
│   ├── validators/        # 9 esquemas Zod
│   ├── workers/           # 3 workers BullMQ
│   ├── app.ts             # Configuración de Express
│   ├── sentry.ts          # Inicialización de Sentry
│   ├── server.ts          # Entrypoint principal
│   ├── worker.ts          # Entrypoint para workers independientes
│   └── __tests__/         # Tests unitarios y de integración
├── scripts/               # Scripts de mantenimiento y despliegue
├── Dockerfile             # Build multi-etapa para producción
├── tsconfig.json          # TypeScript estricto
├── jest.config.js         # Jest + ts-jest
└── package.json
```

**Filosofía de la estructura:**
- **Capa delgada de routing** (`routes/` + `controllers/`): solo conectan HTTP con lógica
- **Capa gruesa de servicios** (`services/`): ahí vive la inteligencia del sistema
- **Modelos tontos** (`models/`): solo definen esquemas, sin lógica de negocio
- **Adaptadores** (`adapters/`): cada fuente externa tiene su traductor
- **Workers** (`workers/`): procesamiento pesado fuera del ciclo request-response

---

## 3. Punto de entrada: server.ts

**Archivo:** `back/src/server.ts`

Este archivo es el bootstrap de toda la aplicación. Su ejecución es una sinfonía de inicializaciones cuidadosamente orquestadas:

### Flujo de inicio

1. **Valida JWT_SECRET** en producción — fail fast si falta
2. **Conecta a MongoDB** con reintento automático
3. **Decide modo de operación:**
   - **Monolith mode** (desarrollo): los workers BullMQ corren en el mismo proceso
   - **Microservices mode** (producción): workers en contenedores separados
4. **Registra handler de `unhandledRejection`** — captura promesas huérfanas, hace log fatal y termina
5. **Inicia el procesador de Outbox** — background processor que cada 5s revisa eventos pendientes
6. **Crea servidor HTTP + Socket.IO** para tiempo real
7. **Inicializa storage** (MinIO/S3) para subida de archivos
8. **Registra jobs programados** (node-cron para los 14 scrapers)
9. **Graceful shutdown** — al recibir SIGTERM/SIGINT cierra en orden: HTTP → Socket → Outbox → Workers → MongoDB → Redis

### Por qué es importante este diseño

Cuando ocurre un terremoto, el tráfico se dispara. Este bootstrap está diseñado para:
- **Fallar rápido** si falta configuración crítica (no medio-arranques)
- **Aislar procesos pesados** (los workers no bloquean la API)
- **No perder eventos** (Outbox garantiza entrega incluso si el proceso muere)
- **Apagar gracefulmente** sin corromper datos

---

## 4. Configuración de Express: app.ts

**Archivo:** `back/src/app.ts`

### Middleware pipeline (en orden de ejecución)

Cada petición HTTP atraviesa esta cadena de middleware, en este orden preciso:

```
Correlation ID → Helmet (CSP) → CORS → Morgan (logs) → Rate Limiter → Compression → Cookie Parser → CSRF → JSON Body Parser → hpp → Rutas → Sentry → Error Handler
```

### Cada middleware, explicado

| Orden | Middleware | ¿Qué hace? | ¿Por qué existe? |
|---|---|---|---|
| 1 | **Correlation ID** | Asigna un UUID a cada request | Trazabilidad: si algo falla, puedes seguir el request por logs, Sentry, y respuestas HTTP |
| 2 | **Helmet + CSP** | HTTP security headers | Previene XSS, clickjacking, MITM. CSP en modo `reportOnly` en desarrollo |
| 3 | **CORS** | Solo orígenes permitidos | El frontend corre en Vercel, el backend en Render. CORS evita que cualquier web haga peticiones |
| 4 | **Morgan** | Logging de HTTP | Saber qué peticiones llegan, desde dónde, y cuánto tardan |
| 5 | **Rate Limiter** | 500 requests por 15 min por IP | Protección contra DDoS y scraping masivo |
| 6 | **Compression** | gzip/brotli en respuestas | Respuestas más rápidas, menos ancho de banda (crítico en emergencias con redes saturadas) |
| 7 | **Cookie Parser** | Lee cookies firmadas | Necesario para CSRF doble cookie y sesión JWT vía cookie |
| 8 | **CSRF** | Double-submit cookie pattern | Previene que un atacante haga POST desde otro sitio usando la sesión del usuario |
| 9 | **Body Parser** | JSON con límite de 1MB | Parsear cuerpos de petición; el límite previene ataques de gran payload |
| 10 | **hpp** | HTTP Parameter Pollution | Si alguien envía `?name=foo&name=bar`, hpp normaliza al primero |
| 11 | **Rutas** | 13 routers Express | Ver sección de rutas |
| 12 | **Sentry** | Error handler de Sentry | Captura errores no manejados antes de que lleguen al error handler final |
| 13 | **Error Handler** | Middleware final | Formatea errores como JSON, distingue errores conocidos (Zod, Mongoose) de desconocidos |

### Health Check

`GET /health` devuelve el estado de MongoDB y Redis. Útil para:
- Load balancers (Render lo usa para saber si el servicio está vivo)
- Monitoreo externo (UptimeRobot, etc.)
- Diagnóstico rápido

```json
{
  "status": "ok",
  "checks": {
    "mongodb": "ok",
    "redis": "ok"
  }
}
```

---

## 5. Modelos de datos (Mongoose)

El sistema tiene **13 modelos**. Cada uno nació de una necesidad concreta durante el diseño. Vamos a recorrerlos.

### 5.1 UnifiedPerson — La entidad más importante

**Archivo:** `back/src/models/unified-person.model.ts`
**Colección:** `persons`

**¿Qué es?** El corazón del sistema. Cada persona reportada como desaparecida, encontrada, fallecida o en estado desconocido vive aquí. Sin importar si llegó por WhatsApp, Telegram, web, scraping o partner — todo se normaliza a este esquema.

**¿Por qué es así?**

```typescript
{
  externalIds: [{ source: string, id: string, addedAt: Date }],
  // Una persona puede aparecer en múltiples fuentes. Este array
  // rastrea todos los IDs externos que le corresponden.
  // Ej: [{ source: 'venezuela-te-busca', id: 'VT-123' },
  //      { source: 'whatsapp', id: 'wa-456' }]

  idHash: string,  // SHA-256(source + externalId) — único, deduplicación
  // La joya de la corona. Al hacer SHA-256 de la fuente + ID externo,
  // obtenemos un hash determinístico. Si la misma persona llega por
  // dos fuentes distintas (con distintos externalIds), tendrá dos
  // idHash diferentes y serán registros separados (lo cual es correcto).
  // Pero si la misma fuente envía el mismo registro dos veces,
  // el idHash será idéntico y el upsert lo actualizará sin duplicar.

  normalizedName: string,  // minúsculas sin acentos
  // Para búsqueda por nombre sin importar tildes o mayúsculas.
  // "María José" → "maria jose"

  embedding: number[],  // select: false — nunca se expone por defecto
  faceEncoding: number[],  // select: false
  // Vectores para matching. El embedding es semántico (texto),
  // el faceEncoding es facial (128-d desde el microservicio vision).
  // select: false significa que una query normal nunca los devuelve
  // — hay que pedirlos explícitamente con .select('+embedding').

  lastSeen: {
    coordinates: { type: 'Point', coordinates: [lng, lat] },
    // GeoJSON Point para búsquedas 2dsphere: "¿quién fue visto
    // cerca del epicentro de este terremoto?"
  },

  metadata: {
    urgencyScore: number,  // 0-100, calculado por IA + geo-enrich
    auditStatus: 'clean' | 'pending_review' | 'merged' | 'dismissed'
                | 'pending_moderation' | 'flagged_moderation',
    // auditStatus es clave para moderación:
    // - clean: procesado por IA, sin problemas
    // - pending_moderation: reporte manual, necesita revisión humana
    // - flagged_moderation: contiene menores (LOPNNA), revisión obligatoria
    isMinor: boolean,
    containsMinor: boolean,
    containsMinorAges: [{ age_range, age_approx }],
    // Protección de menores (LOPNNA). Si la IA detecta que la persona
    // o la foto contiene menores, el reporte se marca y va a moderación
    // especial con protocolos de privacidad reforzados.
  }
}
```

**Índices críticos (6 índices compuestos):**

| Índice | ¿Para qué? |
|---|---|
| `{ normalizedName, lastSeen.state }` | Búsqueda por nombre + estado — el query más común |
| `{ status, urgencyScore }` | Listar por urgencia: los más urgentes primero |
| `{ coordinates: '2dsphere' }` | Geo-queries: desastres cercanos, búsqueda por ubicación |
| `{ externalIds.source, externalIds.id }` | Lookup por fuente externa |
| `{ name: 'text', normalizedName: 'text', ... }` | Full-text search con pesos (name=10, normalizedName=5) |
| `{ auditStatus, status, type }` | Moderación: filtrar pendientes por tipo y estado |

### 5.2 Match — Coincidencias entre reportes

**Archivo:** `back/src/models/match.model.ts`
**Colección:** `matches`

**¿Qué es?** Cuando el motor de matching encuentra que dos reportes probablemente se refieren a la misma persona, crea un Match. Por ejemplo: una familia reporta a "María Pérez" como desaparecida, y un hospital reporta a "María Pérez" como encontrada — el sistema las empareja y un administrador revisa.

**¿Por qué existe como modelo separado?**
- Un Match tiene un **ciclo de vida independiente**: nace como `posible`, puede subir a `probable`, va a `revisar`, y termina como `confirmado` o `descartado`
- Mantiene un **score numérico** (0-1) que permite ordenar por confianza
- Usa **virtuals de Mongoose** para poblar los datos completos de ambas personas sin almacenarlos duplicados

**Estados del workflow:**
```
posible → probable → revisar → confirmado
                              ↘ descartado
```

### 5.3 DisasterEvent — Eventos de desastre

**Archivo:** `back/src/models/disaster-event.model.ts`
**Colección:** `disaster_events`

**¿Qué es?** Representa un desastre natural o evento social relevante. Puede ser un terremoto (USGS/FUNVISIS), una inundación (INAMEH), un incendio satelital (NASA FIRMS), un deslave, un huracán, o un evento social.

**¿Por qué es importante?** Con el índice `2dsphere` y el radio de afectación, el sistema puede:
1. Preguntar: "Este reporte de persona desaparecida, ¿está cerca del epicentro de este terremoto?"
2. Responder: "Sí, está a 15km — probablemente está relacionado"
3. Acción: aumentar el `urgencyScore` y vincular la persona al desastre

**Tipos de desastre:**
- `earthquake`: terremotos (USGS, FUNVISIS)
- `flood`: inundaciones (INAMEH)
- `fire`: incendios activos satelitales (NASA FIRMS)
- `hurricane`: huracanes (GDACS)
- `landslide`: deslaves
- `social`: eventos sociales (protestas, desplazamientos)

### 5.4 User — Cuentas de usuario

**Archivo:** `back/src/models/user.model.ts`
**Colección:** `users`

Almacena usuarios con doble autenticación (Google OAuth + email/password). Tiene `tokenVersion` para revocación de sesión, `role` para control de acceso (user/verifier/admin), y `status` para el flujo de solicitud de verificador.

### 5.5 Localizado — Personas encontradas en refugios

**Archivo:** `back/src/models/localizado.model.ts`
**Colección:** `localizados`

Personas que están en refugios, hospitales o albergues, reportadas por partners (Protección Civil, Cruz Roja). Se muestran como "encontradas" en el frontend.

### 5.6 SearchRequest — Solicitudes de búsqueda de familias

**Archivo:** `back/src/models/search-request.model.ts`
**Colección:** `search_requests`

Cuando una familia busca a un ser querido, crea una SearchRequest. El motor de matching busca coincidencias con UnifiedPerson. Tiene:
- `searchName`: nombre de la persona buscada
- `category`: minor / adult / pet
- `embedding`: vector semántico para matching
- `status`: activa / pausada / completada
- `assignedVerifier`: opcional, un verificador asignado al caso

### 5.7 CaseContact — Sistema de mensajería enmascarada

**Archivo:** `back/src/models/case-contact.model.ts`
**Colección:** `case_contacts`

Permite que dos usuarios se comuniquen sin exponer datos de contacto. Funciona como un **relé**: el sistema recibe el mensaje de A, lo almacena, y B lo ve en su bandeja. Ninguno ve el teléfono/email del otro hasta que ambos aceptan. Es la implementación del principio de **privacidad por diseño**: la plataforma facilita el reencuentro pero protege los datos personales.

### 5.8 ApiKey — Claves para integraciones

**Archivo:** `back/src/models/api-key.model.ts`
**Colección:** `api_keys`

Para partners y webhooks. La clave se almacena como SHA-256 (nunca en texto plano). Tres tipos:
- `admin`: acceso total al panel administrativo
- `webhook`: solo para recibir eventos (WhatsApp, Telegram)
- `partner`: para ONGs que reportan desde sus sistemas

### 5.9 Outbox — Patrón Transactional Outbox

**Archivo:** `back/src/models/outbox.model.ts`
**Colección:** `outboxes`

Almacena eventos que deben procesarse asíncronamente después de una operación de base de datos. Cuatro tipos:
- `person-matching`: nueva persona, buscar coincidencias
- `ia-processing`: procesar con IA
- `geo-enrich`: enriquecer con desastres cercanos
- `manual-audit`: necesita revisión humana

Máximo 5 reintentos, TTL de 7 días (los eventos viejos se limpian automáticamente).

### 5.10 AuditLog — Registro de auditoría

**Archivo:** `back/src/models/audit-log.model.ts`
**Colección:** `audit_logs`

Colección **capped** (1GB o 1M documentos, lo que se alcance primero). Cada acción administrativa queda registrada: quién, qué, cuándo, y estado anterior/nuevo. Es inmodificable: una vez escrito, no se puede borrar ni cambiar.

### 5.11 SyncState — Control de sincronización

**Archivo:** `back/src/models/sync-state.model.ts`
**Colección:** `sync_states`

Para cada fuente externa, guarda un checksum MD5 del último payload procesado. Si el checksum no ha cambiado, el scraper salta la sincronización (optimización). También lleva conteo de registros procesados y estado de la última sincronización.

### 5.12 StateHistory — Historial de cambios de estado

**Archivo:** `back/src/models/state-history.model.ts`
**Colección:** `state_histories`

Cada vez que un reporte cambia de estado (missing → found, por ejemplo), se registra aquí. quién lo cambió, desde qué estado, a qué estado, y cuándo.

### 5.13 VerificationRequest — Solicitudes de verificador

**Archivo:** `back/src/models/verification-request.model.ts`
**Colección:** `verification_requests`

Usuarios que piden ser verificadores (rol verifier). Deben enviar evidencia de su vinculación con organismos de rescate. Un admin revisa y aprueba/rechaza.

---

## 6. Rutas y controladores

### Filosofía de diseño

Las rutas son **declarativas**: conectan un path HTTP con un controlador. Los controladores son **delgados**: validan la request, llaman al servicio correspondiente, y devuelven la response. La lógica pesada vive en `services/`.

### Mapa completo de rutas

| Método | Path | Autenticación | Controlador | ¿Qué hace? |
|---|---|---|---|---|
| **Públicas** | | | | |
| GET | `/health` | — | inline | Health check |
| GET | `/api/persons` | — | `person.controller` | Lista paginada de personas |
| GET | `/api/persons/counts` | — | `person.controller` | Estadísticas cacheadas (Redis 5min) |
| POST | `/api/persons` | — | `person.controller` | Reportar persona (con dedup) |
| GET | `/api/disasters` | — | `disasters.controller` | Todos los desastres |
| GET | `/api/disasters/active` | — | `disasters.controller` | Desastres activos |
| POST | `/api/search/vector` | — | `search.controller` | Búsqueda semántica vectorial |
| GET | `/api/cne/:nationality/:cedula` | — | `cne.controller` | Consulta de cédula venezolana |
| GET | `/api/localizados` | — | `localizado.controller` | Personas en refugios |
| **Autenticadas (JWT)** | | | | |
| GET | `/api/persons/mine` | JWT | `person.controller` | Mis reportes |
| POST | `/api/contact/send` | JWT | `contact.controller` | Enviar mensaje enmascarado |
| POST | `/api/search-requests` | JWT | `search-request.controller` | Crear solicitud de búsqueda |
| POST | `/api/media` | JWT | `media.controller` | Subir archivo multimedia |
| POST | `/api/media/analyze-image` | JWT | `media.controller` | Análisis de imagen con IA |
| POST | `/api/media/audio-transcribe` | JWT | `media.controller` | Transcripción de audio (Whisper) |
| GET | `/api/matches/:reportId` | JWT | `matches.controller` | Matches de un reporte |
| **Auth** | | | | |
| GET | `/api/auth/csrf-token` | — | `auth.controller` | Sembrar token CSRF |
| POST | `/api/auth/google` | Rate: 5/15min | `auth.controller` | Login con Google |
| POST | `/api/auth/register` | Rate: 10/15min | `auth.controller` | Registro email/password |
| POST | `/api/auth/login` | Rate: 5/15min | `auth.controller` | Login email/password |
| GET | `/api/auth/me` | — | `auth.controller` | Restaurar sesión |
| POST | `/api/auth/logout` | — | `auth.controller` | Cerrar sesión |
| **Integración (API Key)** | | | | |
| GET/POST | `/api/partner/cases` | `x-partner-api-key` | `partner.controller` | CRUD de casos partner |
| POST | `/api/localizados` | `x-partner-api-key` | `localizado.controller` | Ingesta masiva de localizados |
| POST | `/api/webhooks/n8n/whatsapp` | `x-webhook-api-key` | `webhooks.controller` | Webhook WhatsApp |
| POST | `/api/webhooks/n8n/telegram` | `x-webhook-api-key` | `webhooks.controller` | Webhook Telegram |
| **Admin (API Key)** | | | | |
| GET/POST | `/api/admin/*` | `x-api-key` | `admin.controller` | CRUD administrativo |
| POST | `/api/admin/merge/:id1/:id2` | Admin | `admin.controller` | Fusionar perfiles duplicados |

### Por qué hay dos tipos de autenticación

- **JWT** para usuarios humanos: sesión con tokenVersion para revocación
- **API Key** para máquinas: partners, webhooks, admin — cada una con permisos específicos

---

## 7. Servicios: el corazón de la lógica

Los servicios son donde realmente vive la inteligencia del sistema. Hay más de 27 servicios organizados por dominio.

### 7.1 Servicios core

| Servicio | Archivo | Responsabilidad |
|---|---|---|
| `person.service` | `services/person.service.ts` | CRUD de personas con upsert por idHash |
| `person-read.service` | `services/person-read.service.ts` | Queries de solo lectura (paginación, filtros) |
| `matcher.service` | `services/matcher.service.ts` | Motor de matching vectorial + facial |
| `matches.service` | `services/matches.service.ts` | CRUD de MatchModel |
| `sync-source.service` | `services/sync-source.service.ts` | Pipeline adapter → validación → upsert |
| `sync-state.service` | `services/sync-state.service.ts` | Checksums MD5 para evitar re-procesar |
| `disaster.service` | `services/disaster.service.ts` | Lógica geoespacial de desastres |
| `disaster-events.service` | `services/disaster-events.service.ts` | CRUD de DisasterEvent |
| `outbox.service` | `services/outbox.service.ts` | Procesador de Transactional Outbox |
| `reconciliation.service` | `services/reconciliation.service.ts` | Pipeline de reconciliación con IA |
| `bridge.service` | `services/bridge.service.ts` | Puente con BD legacy SQL |
| `storage.service` | `services/storage.service.ts` | Subida/descarga de archivos (MinIO/S3) |
| `pinecone.service` | `services/pinecone.service.ts` | Indexación y consulta vectorial en Pinecone |
| `socket.service` | `services/socket.service.ts` | WebSocket con Redis adapter |
| `contact.service` | `services/contact.service.ts` | Lógica de mensajería enmascarada |
| `partner.service` | `services/partner.service.ts` | Integración con partners |
| `api-key.service` | `services/api-key.service.ts` | Gestión de API keys (SHA-256) |
| `search-request.service` | `services/search-request.service.ts` | Lógica de solicitudes de búsqueda |
| `localizado.service` | `services/localizado.service.ts` | CRUD de personas localizadas |
| `bull-board.service` | `services/bull-board.service.ts` | UI de monitoreo de colas |

### 7.2 Servicios administrativos (`services/admin/`)

| Servicio | Responsabilidad |
|---|---|
| `audit.service.ts` | Consultas al AuditLog |
| `user.service.ts` | Gestión de usuarios (roles, verificación) |
| `person.service.ts` | Admin CRUD de personas |
| `match.service.ts` | Admin CRUD de matches |
| `search.service.ts` | Historial de búsquedas |
| `lopnna.service.ts` | Gestión de casos LOPNNA (protección de menores) |

### 7.3 Servicios de IA (`services/ai/`)

Implementan el patrón **Factory** para intercambiar proveedores de IA sin cambiar el código:

| Archivo | Rol |
|---|---|
| `ai.interface.ts` | Interfaz común (processRecord, generateEmbedding) |
| `ai.factory.ts` | Factory que devuelve el proveedor según env var |
| `anthropic.service.ts` | Implementación con Claude |
| `openai.service.ts` | Implementación con GPT |
| `gemini.service.ts` | Implementación con Gemini de Google |

Ver sección detallada [más adelante](#15-múltiples-proveedores-de-ia).

### 7.4 Pipeline de ingesta: sync-source.service.ts

**Archivo:** `back/src/services/sync-source.service.ts`

Este es el pipeline que toda fuente externa atraviesa:

```
Datos crudos (API/CSV/Webhook/Scraper)
    ↓
Adapter.normalize() — transforma al formato interno
    ↓
Zod personPayloadSchema.safeParse() — valida tipos, longitudes, sanitiza
    ↓   ↓
 Éxito  Falla → log warning, failed++
    ↓
Agrega a batch (máximo 100)
    ↓
upsertPerson() — busca por idHash, crea o actualiza
    ↓
addToOutbox('person-matching') — encola matching asíncrono
```

**Idempotencia garantizada:** Ejecutar el mismo scraper 100 veces produce el mismo resultado. El idHash SHA-256 asegura que si el registro ya existe, se actualiza sin duplicar.

---

## 8. Adaptadores: normalización de fuentes externas

**Archivo:** `back/src/adapters/`

Cada fuente externa tiene su propio formato. Los adaptadores son traductores que convierten datos de la fuente al esquema interno de UnifiedPerson.

### Interface base

```typescript
interface ISourceAdapter<T> {
  normalize(raw: T): UnifiedPersonInput;
}
```

### Adaptadores existentes

| Adaptador | Fuente | ¿Qué hace? |
|---|---|---|
| `reencuentro.adapter.ts` | API propia de Reencuentro | Normaliza reportes de la plataforma hermana |
| `venezuelareporta.adapter.ts` | VenezuelaReporta | Traduce el formato de VenezuelaReporta |
| `venezuela-te-busca.adapter.ts` | Venezuela Te Busca | Normaliza datos de Venezuela Te Busca |
| `web-form.adapter.ts` | Formulario web | Traduce datos del formulario público |
| `factory.adapter.ts` | — | Registry + factory para obtener el adapter correcto según la fuente |

### Por qué el patrón Adapter

Cuando una nueva fuente se integra (por ejemplo, "Cruz Roja Internacional"), solo necesitas:
1. Crear un nuevo adapter que implemente `ISourceAdapter`
2. Registrar el adapter en el factory
3. El resto del pipeline (validación, upsert, matching) funciona sin cambios

Es **Open/Closed Principle** en acción: abierto a extensiones, cerrado a modificaciones.

---

## 9. Scrapers y jobs programados

**Directorio:** `back/src/jobs/`

14 scrapers que se ejecutan con node-cron, orquestados desde `disaster-sync.worker.ts`. Cada scraper:

1. Obtiene datos de la fuente (API REST, RSS, web scraping, CSV)
2. Pasa los datos por el adapter correspondiente
3. Encola en la cola `disaster-sync` para procesamiento
4. El worker procesa, valida, y persiste

### Lista completa de scrapers

| Scraper | Fuente | Datos | Frecuencia |
|---|---|---|---|
| `usgs.job.ts` | US Geological Survey | Terremotos globales | Cada 15 min |
| `firms.job.ts` | NASA FIRMS | Incendios activos satelitales | Cada 30 min |
| `gdacs.job.ts` | GDACS (UN/UE) | Alertas globales de desastres | Cada 30 min |
| `funvisis.job.ts` | FUNVISIS | Sismología venezolana | Cada 10 min |
| `inameh.job.ts` | INAMEH | Clima e hidrometeorología Venezuela | Cada 60 min |
| `corpoelec.job.ts` | CORPOELEC | Cortes eléctricos Venezuela | Cada 30 min |
| `proteccion-civil.job.ts` | Protección Civil | Alertas de PC Venezuela | Cada 30 min |
| `cruz-roja.job.ts` | Cruz Roja Venezuela | Reportes de personas | Cada 30 min |
| `dtv.job.ts` | DTV | Fuente DTV | Cada 30 min |
| `reencuentro.job.ts` | API Reencuentro | Reportes de plataforma hermana | Cada 15 min |
| `venezuelareporta.job.ts` | VenezuelaReporta | Reportes de VenezuelaReporta | Cada 15 min |
| `reconcile.job.ts` | Interno | Reconciliación de datos internos | Cada 60 min |
| `lopnna-sweep.job.ts` | Interno | Barrido de protección de menores | Cada 120 min |
| `biometric-sweep.job.ts` | Interno | Barrido biométrico facial | Cada 120 min |

### Por qué 14 scrapers

Venezuela no tiene una fuente única de datos de desaparecidos. La información está fragmentada entre:
- **Organismos internacionales** (USGS, GDACS, NASA) — alertas tempranas
- **Organismos nacionales** (FUNVISIS, INAMEH, CORPOELEC) — datos locales
- **ONGs** (Cruz Roja, Protección Civil) — reportes de terreno
- **Plataformas ciudadanas** (VenezuelaReporta, Reencuentro) — datos de la comunidad
- **Redes sociales y mensajería** (WhatsApp, Telegram) — vía webhooks

Cada scraper está diseñado para ser independiente: si una fuente falla, las demás siguen funcionando.

---

## 10. Workers BullMQ: procesamiento asíncrono

**Directorio:** `back/src/workers/`

Los workers son procesos que corren en segundo plano, separados del ciclo request-response de Express. Esto es crucial: cuando un usuario reporta una persona, la API responde inmediatamente (202 Accepted) y el procesamiento pesado (IA, matching, geo-enrich) ocurre en los workers.

### Arquitectura de Workers

```
API (Express)                  Workers (BullMQ)
    │                              │
    │  POST /persons ──────────┐   │
    │  (responde 202)          │   │
    │                          │   │
    │                    ┌─────┘   │
    │                    ▼         │
    │              ┌──────────┐    │
    │              │  Outbox   │    │
    │              │ (MongoDB) │    │
    │              └─────┬────┘    │
    │                    │         │
    │     ┌──────────────┼─────────┼──┐
    │     │              │         │  │
    │     ▼              ▼         ▼  │
    │ ┌─────────┐ ┌──────────┐ ┌──────┘
    │ │ Person  │ │ Disaster │ │ IA
    │ │ Matching│ │ Sync     │ │ Processor
    │ └─────────┘ └──────────┘ └──────┘
```

### Worker 1: IA Processor (`ia-processor.worker.ts`)

**Cola:** `ia-process` · **Concurrencia:** 1

**¿Qué hace?** Es el worker más complejo. Procesa cada reporte con este pipeline:

```
1. Recibe job con datos crudos del reporte
2. Si hay foto:
   a. Llama al microservicio vision (Python/FastAPI) para:
      - Extraer encoding facial (vector 128-d)
      - Detectar edad estimada (Caffe modelo de edad)
      - Determinar si hay menores en la foto (protección LOPNNA)
3. IA analiza la descripción textual:
   - Extrae nombre, estado, edad estimada
   - Genera descripción segura (sin PII)
   - Calcula urgencyScore
4. Valida output de IA con Zod (aiOutputSchema)
5. Genera embedding vectorial (texto) para Pinecone/Atlas
6. Reconciliación: busca perfiles existentes con el mismo nombre+estado
7. Si corresponde, upsert a Pinecone para búsqueda vectorial
8. Emite notificación Socket.IO al usuario
```

**Decisiones técnicas importantes:**
- **Timeout de 35s** para el servicio vision (balance entre calidad y latencia)
- **Graceful degradation**: si face encoding falla, el proceso continúa sin él
- **Concurrencia 1**: procesa un reporte a la vez para no saturar la BD ni la IA
- **Menores primero**: si detecta un menor, el urgencyScore sube a 10 (vs 1 para adultos)

### Worker 2: Disaster Sync (`disaster-sync.worker.ts`)

**Cola:** `disaster-sync`

Procesa los datos de los 14 scrapers. Cada job contiene un lote de eventos de desastre que se normalizan, validan, y persisten.

### Worker 3: Person Matching (`matching.worker.ts`)

**Cola:** `person-matching`

**¿Qué hace?** Es el worker más ligero — recibe un job con `{ idHash, source }` y delega todo el trabajo pesado a `matcher.service.ts`. Su única responsabilidad es encolar y loguear. Cada vez que se crea o actualiza una persona, este worker busca coincidencias con personas existentes.

---

## 11. Transactional Outbox: garantía de entrega

**Archivo:** `back/src/services/outbox.service.ts`

### El problema que resuelve

Cuando un usuario reporta una persona, deben ocurrir varias cosas:
1. Guardar la persona en MongoDB
2. Procesar con IA
3. Buscar coincidencias (matching)
4. Enriquecer con desastres cercanos (geo-enrich)

Si hacemos todo sincrónicamente, el usuario espera minutos. Si lo hacemos asíncronamente pero el proceso falla entre el paso 1 y el 2, perdemos el evento.

### La solución: Outbox Pattern

```
1. upsertPerson(persona)
2. addToOutbox('person-matching', { idHash })  ← misma transacción
   ─────────────────────────────────────────
   Si el servidor se cae aquí, no pasa nada:
   el evento ya está persistido en MongoDB.
   Al reiniciar, el procesador lo retomará.
3. Procesador background cada 5s:
   - Lee eventos pending con attempts < 5
   - Los encola en BullMQ según tipo
   - Marca como completed o incrementa attempts
```

### Tipos de eventos

| Tipo | Cola destino | ¿Qué desencadena? |
|---|---|---|
| `person-matching` | `personMatchingQueue` | Nueva persona → busca coincidencias |
| `ia-processing` | `iaProcessQueue` | Reporte manual → procesa con IA |
| `geo-enrich` | (síncrono en outbox) | Nueva persona → busca desastres cercanos |
| `manual-audit` | `manualAuditQueue` | Reporte marcado → va a revisión humana |

### Geo-enrichment: el detalle fino

Cuando se crea una persona, el outbox ejecuta `handleGeoEnrich`:
1. Busca desastres en un radio de 30km usando el índice `2dsphere`
2. Calcula un bonus de urgencia según la severidad y cercanía del desastre
3. Actualiza `metadata.urgencyScore` (cap en 100)
4. Vincula la persona al desastre (`possiblyRelatedDisasters`)

Esto significa que si reportas a alguien en el estado Lara y justo hubo un terremoto allí, el sistema automáticamente le da más urgencia a ese reporte.

---

## 12. Middlewares: seguridad y trazabilidad

**Directorio:** `back/src/middlewares/`

### 12.1 auth.middleware.ts

Dos estrategias de autenticación:
- **JWT**: verifica `Authorization: Bearer <token>` o cookie `token`. Verifica `tokenVersion` en BD (para revocación de sesión). Distingue roles (user/verifier/admin).
- **API Key**: para integraciones machine-to-machine. Busca el hash SHA-256 de la key en `ApiKeyModel`.

### 12.2 csrf.middleware.ts

Implementa **Double-Submit Cookie Pattern**:
1. El backend setea una cookie `csrf-token` con un valor aleatorio
2. El frontend lee la cookie y la envía como header `x-csrf-token`
3. El backend compara: cookie === header
4. Exento para: `/api/webhooks`, `/api/auth/google`, `/api/localizados` (integradores que no pueden leer cookies)

### 12.3 audit.middleware.ts

Registra cada acción admin en el AuditLog. Captura:
- Usuario (quién)
- Acción (qué)
- Ruta y método
- Timestamp
- Estado anterior y nuevo (si aplica)

### 12.4 correlation.middleware.ts

Asigna un `X-Correlation-ID` a cada request. Este ID viaja por todos los logs, Sentry, y respuestas. Permite seguir el rastro de una petición a través de todo el sistema.

### 12.5 error.middleware.ts

Middleware final que captura errores y los formatea como JSON:
- **Errores conocidos**: Zod (validation), Mongoose (cast, duplicate key), JWT — mensajes descriptivos
- **Errores desconocidos**: mensaje genérico, log completo, Sentry captura

### 12.6 validate.middleware.ts

Middleware genérico que ejecuta un esquema Zod contra `req.body`, `req.query`, o `req.params`.

---

## 13. Validadores Zod

**Directorio:** `back/src/validators/`

Toda entrada que llega al sistema pasa por un esquema Zod. No hay excepciones. Esto es **defense in depth**: aunque el frontend valide, el backend siempre vuelve a validar.

| Validador | ¿Qué valida? |
|---|---|
| `person.validator.ts` | Payload de persona (nombre, datos, ubicación) |
| `auth.validator.ts` | Login, registro, perfil |
| `admin.validator.ts` | Acciones administrativas |
| `localizado.validator.ts` | Personas en refugios |
| `matches.validator.ts` | Actualización de matches |
| `partner.validator.ts` | Datos de partners |
| `search-request.validator.ts` | Solicitudes de búsqueda |
| `venezuela.validator.ts` | Formato de cédula venezolana |
| `webhooks.validator.ts` | Payloads de WhatsApp y Telegram |

### Ejemplo: personPayloadSchema

Valida que:
- `name` sea string no vacío
- `type` sea 'person' o 'animal'
- `date` sea fecha válida
- `data` contenga solo campos permitidos (nunca PII no autorizada)
- `photoUrl` sea URL válida si existe

---

## 14. Servicio de Matching

**Archivo:** `back/src/services/matcher.service.ts`

Este es el motor que conecta a las familias con sus seres queridos. Cuando se reporta una persona o se crea una solicitud de búsqueda, este servicio busca coincidencias.

### ¿Cómo funciona?

Tres estrategias de matching, en orden de preferencia:

#### Estrategia 1: Pinecone Vector Search (cuando está activo)

Usa Pinecone, una base de datos vectorial especializada, para buscar los top-10 candidatos por similitud semántica. El embedding textual se genera con el proveedor de IA configurado.

**¿Qué es un embedding?** Es una representación numérica del significado del texto. "María Pérez, 30 años, buscada en Caracas" y "María Pérez, de 30, desaparecida en Caracas" tendrán embeddings muy similares, aunque las palabras exactas sean diferentes.

#### Estrategia 2: Atlas Vector Search (MongoDB)

Cuando `USE_ATLAS_VECTOR_SEARCH=true`, usa el pipeline `$vectorSearch` de MongoDB Atlas. Más simple (no requiere servicio externo) pero menos potente que Pinecone.

#### Estrategia 3: Cálculo Local (fallback)

Si no hay vector DB, trae todas las personas con embeddings a memoria y calcula similitud coseno manualmente. **Esto está diseñado para prototipos** — en producción se usa Pinecone o Atlas.

### Face Encoding Matching

Además del matching textual, el sistema hace matching facial:
1. Extrae el face encoding de la persona (vector 128-d desde el microservicio vision)
2. Compara con todas las personas que tienen face encoding usando **distancia euclidiana**
3. Si la distancia es < 0.6, crea un Match con score proporcional

### Umbrales de decisión

| Score | ¿Qué significa? | Acción |
|---|---|---|
| > 0.6 | Posible coincidencia | Crea Match con status 'posible' |
| > 0.85 | Coincidencia probable | Crea Match con status 'probable' |
| ≤ 0.6 | Baja probabilidad | No crea Match (ahorra trabajo admin) |

### Siempre con confirmación humana

Ningún Match se confirma automáticamente. El score y status guían al administrador, pero la decisión final siempre es humana. Esto es una decisión deliberada de diseño: en un tema tan sensible como encontrar personas desaparecidas, la tecnología asiste pero no reemplaza el juicio humano.

---

## 15. Múltiples proveedores de IA

**Directorio:** `back/src/services/ai/`

### Patrón Factory

```typescript
// ai.factory.ts
function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || 'anthropic';
  switch (provider) {
    case 'anthropic': return new AnthropicProvider();
    case 'openai':    return new OpenAIProvider();
    case 'gemini':    return new GeminiProvider();
  }
}
```

### Interfaz común

```typescript
interface AIProvider {
  processRecord(text: string): Promise<{
    name?: string;
    estado?: string;
    age?: number;
    urgencyScore?: number;
    safeDescription?: string;
  }>;
  generateEmbedding(text: string): Promise<number[]>;
}
```

### ¿Qué hace la IA con un reporte?

Cuando un ciudadano reporta "Vi a una señora como de 60 años en la plaza Bolívar de Barquisimeto, dice llamarse María, tiene el cabello canoso y estaba desorientada", la IA:

1. **Extrae nombre**: "María"
2. **Determina ubicación**: "Barquisimeto, Lara"
3. **Estima edad**: ~60 años
4. **Calcula urgencia**: basado en contexto (desorientada → mayor urgencia)
5. **Genera embedding**: vector numérico para matching

### Multi-provider: ¿por qué?

- **Resiliencia**: si un proveedor cae (outage de OpenAI, rate limit de Anthropic), se cambia la env var y el sistema sigue funcionando
- **Costo**: se puede usar Gemini para tareas simples y Claude para las complejas
- **Calidad**: diferentes modelos tienen diferentes fortalezas

---

## 16. Almacenamiento y archivos multimedia

**Archivo:** `back/src/services/storage.service.ts`

### ¿Qué almacena?

- Fotos de personas reportadas
- Audios de reportes por voz
- Documentos adjuntos

### Backend de almacenamiento

Usa el SDK de AWS S3, compatible con:
- **MinIO** (desarrollo local)
- **Supabase Storage** (producción)
- Cualquier servicio S3-compatible

### Flujo de subida

```
Cliente → POST /api/media (JWT) → Storage Service → MinIO/S3
                                                      ↓
                                              Devuelve URL pública
                                                      ↓
                                              Se guarda en UnifiedPerson.photoUrl
```

### Validación de archivos

`file-validate.util.ts` verifica:
- **Magic bytes**: no confía en la extensión del archivo, verifica los primeros bytes
- **Tamaño máximo**: configurable
- **Tipo MIME**: solo imágenes y audio permitidos

---

## 17. Socket.IO: notificaciones en tiempo real

**Archivo:** `back/src/services/socket.service.ts`

Socket.IO con Redis adapter permite escalar horizontalmente (múltiples instancias comparten el estado de conexiones).

### Canales (rooms)

| Room | ¿Quién escucha? | ¿Qué recibe? |
|---|---|---|
| `user:{userId}` | El usuario específico | Notificaciones de sus reportes procesados |
| `moderator` | Administradores | Nuevos matches, reportes para revisar |
| `chat:{caseId}` | Participantes de un chat | Mensajes del sistema de contacto |
| `lopnna` | Moderadores LOPNNA | Alertas de casos con menores |

### Eventos que emite

- `notification`: cuando un reporte termina de procesarse
- `new-match`: cuando se encuentra una coincidencia
- `message`: nuevo mensaje en el chat de contacto
- `lopnna-alert`: cuando se detecta un posible caso de menor

---

## 18. Monitoreo: Sentry y Bull Board

### Sentry

**Archivo:** `back/src/sentry.ts`

Inicializado con:
- **Error tracking**: captura todas las excepciones no manejadas
- **Performance tracing**: mide tiempos de respuesta de cada endpoint
- **Release tracking**: asocia errores a versiones específicas

### Bull Board

**Endpoint:** `/api/admin/queues` (protegido con API Key)

Interfaz web para monitorear las colas BullMQ:
- Ver jobs pendientes, activos, completados y fallidos
- Re-encolar jobs fallidos
- Ver datos de cada job
- Monitorear workers activos

---

## 19. Seguridad integral

### Capas de defensa (de afuera hacia adentro)

```
1. Cloudflare / Render FW           ← Protección de red
2. Helmet (CSP, HSTS, X-Frame)      ← Headers HTTP seguros
3. CORS restringido                 ← Solo orígenes permitidos
4. Rate Limiting                    ← 500 req/15min por IP
5. CSRF Double-Submit Cookie        ← Previene ataques cross-site
6. Validación Zod                   ← Toda entrada es validada
7. Sanitize HTML                    ← XSS prevention
8. Magic bytes validation           ← Archivos subidos
9. PII redaction en logs            ← Datos sensibles no se loguean
10. select: false en campos sensibles ← Embeddings nunca expuestos
11. idHash en lugar de datos reales    ← No expone IDs externos
12. Contact relay pattern              ← Datos de contacto protegidos
```

### Protección de menores (LOPNNA)

La Ley Orgánica para la Protección de Niños, Niñas y Adolescentes de Venezuela exige protección especial. El sistema implementa:

1. **Flag automático**: la IA detecta edades estimadas ≤ 20 y marca el reporte
2. **AuditStatus especial**: `flagged_moderation` — no pasa por el flujo normal
3. **Moderación especializada**: solo administradores con entrenamiento LOPNNA pueden ver estos casos
4. **Datos mínimos**: las fotos de posibles menores no se exponen en APIs públicas

### Gestión de sesiones

- **JWT con tokenVersion**: si un administrador revoca una sesión, incrementa el tokenVersion en BD y todos los JWT existentes quedan inválidos
- **Doble canal**: cookie httpOnly + Bearer token (para compatibilidad con proxy de Vercel)
- **Logout**: limpia cookie del lado servidor

---

## 20. Docker y despliegue

### docker-compose.yml

Define 6 servicios para desarrollo local:

```yaml
services:
  mongodb:  # MongoDB 7, puerto 27017
  redis:    # Redis 7 Alpine, puerto 6379
  minio:    # S3-compatible storage, puertos 9000 (API) y 9001 (Console)
  api:      # Express API, puerto 4000
  worker:   # BullMQ worker (misma imagen que api)
  vision:   # Python/FastAPI, puerto 8000
```

### Dockerfile (back)

Multi-stage build:
1. **Stage 1 - Dependencies**: npm ci (solo dependencias de producción)
2. **Stage 2 - Build**: TypeScript compilation
3. **Stage 3 - Runtime**: Node.js 22 Alpine, solo lo necesario

### Modos de despliegue

| Modo | Variables | ¿Qué corre? |
|---|---|---|
| **Monolith** (desarrollo) | `RUN_WORKERS_IN_API=true` | Todo en un proceso |
| **Microservices** (producción) | `RUN_WORKERS_IN_API=false` | API y workers separados |

### CI/CD

GitHub Actions en `.github/workflows/ci.yml`:
- Trigger: push/PR a main
- Build: Node 20, `npm ci` + `npm run build` para back y front

---

## Nota final: el porqué de cada decisión

Cada línea de este backend fue escrita pensando en una realidad específica: la de Venezuela después de un desastre natural.

- **14 scrapers** porque la información está fragmentada en decenas de fuentes
- **idHash SHA-256** porque necesitamos deduplicar sin identificar personas
- **Offline-first en el frontend** porque en emergencias el internet es intermitente
- **Multi-provider IA** porque no podemos depender de un solo servicio externo
- **Siempre confirmación humana** porque la tecnología asiste, pero no reemplaza el juicio humano
- **Privacidad por diseño** porque las personas vulnerables merecen protección

Este backend no es solo código. Es un puente entre quienes buscan y quienes encuentran.
