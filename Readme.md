# Reencuentro Terremoto Venezuela

> **Misión:** Plataforma tecnológica robusta, segura y abierta para centralizar la búsqueda de personas desaparecidas, las alertas de emergencia y el reencuentro de familias venezolanas tras desastres naturales.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node-22-5FA04E?logo=nodedotjs)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Arquitectura de **microservicios** con Node.js + React, diseñada para resistir picos de tráfico durante emergencias. Ingestiona, limpia, deduplica y centraliza cientos de miles de reportes de múltiples fuentes en una **única fuente de verdad**, con asistencia de IA y **privacidad por diseño**.

> Repositorio público. Nunca se versionan secretos, claves ni datos personales (PII). `.env` está en `.gitignore`.

---

## Tabla de Contenidos

- [¿Qué hace?](#qué-hace)
- [Stack Tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Modelo de Datos](#modelo-de-datos)
- [Desarrollo Local](#desarrollo-local)
- [Variables de Entorno](#variables-de-entorno)
- [API](#api)
- [Seguridad](#seguridad)
- [Documentación](#documentación)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

---

## ¿Qué hace?

- **Centraliza** reportes de personas desaparecidas y encontradas desde 9 fuentes externas (USGS, NASA FIRMS, GDACS, FUNVISIS, INAMEH, CORPOELEC, DTV, Reencuentro API, VenezuelaReporta) más webhooks de WhatsApp/Telegram, formulario web, y jobs internos de reconciliación biométrica y LOPNNA.
- **Deduplica** automáticamente con huella criptográfica (`idHash` SHA-256): múltiples reportes de la misma persona se fusionan en un solo registro.
- **Estructura** texto libre con IA (Anthropic/OpenAI/Gemini intercambiables): un mensaje caótico de WhatsApp se convierte en datos limpios y estructurados.
- **Empareja** búsquedas de familias con registros mediante matching vectorial (Pinecone/Atlas) y facial (face_recognition), siempre con confirmación humana.
- **Protege la privacidad**: datos de contacto nunca se exponen en APIs públicas, los mensajes entre usuarios usan un sistema de relé enmascarado, los menores tienen protección especial (LOPNNA), y las ubicaciones en mapas son aproximadas.
- **Offline-first**: service worker personalizado + IndexedDB (Dexie) permiten reportar personas incluso sin conexión a internet.
- **Procesa en segundo plano**: colas BullMQ para IA, matching y sincronización de desastres sin bloquear la experiencia del usuario.
- **Monitorea todo**: Sentry para errores, Pino para logs estructurados con redacción de PII, Bull Board para colas.

---

## Stack Tecnológico

### Frontend (`front/`)

| Capa | Tecnología |
|---|---|
| UI | React 19, TypeScript 6, Vite 8 (SWC) |
| Mapas | Leaflet + React-Leaflet 5 + react-leaflet-cluster |
| Íconos | Lucide React |
| Estilos | CSS plano con Custom Properties (tema oscuro obligatorio) |
| Ruteo | Por estado (`useState<View>`), sin URLs |
| PWA | Service Worker personalizado (injectManifest) + Dexie 4 (IndexedDB) |
| HTTP | Axios con interceptor CSRF automático |
| Auth | Google OAuth + JWT (doble canal: cookie + Bearer) |
| Tiempo real | Socket.IO (notificaciones, chat) |
| Monitoreo | Sentry (frontend + backend) |
| Linter | Oxlint (sin ESLint, sin Prettier) |
| Tests | Vitest 4 + jsdom + @testing-library/react |
| Despliegue | Vercel (CDN global, SPA fallback) |

### Backend (`back/`)

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 22, TypeScript 6, Express 5, CommonJS |
| Base de datos | MongoDB 7, Mongoose 9, índices 2dsphere |
| Caché y colas | Redis 7 (ioredis), BullMQ 5 (4 colas) |
| Validación | Zod 4 (9 esquemas, toda entrada validada) |
| IA | Provider pattern: Anthropic Claude, OpenAI GPT, Google Gemini |
| Almacenamiento | S3-compatible (MinIO local / Supabase producción) |
| Auth | JWT (HS256) + Google OAuth + API keys (SHA-256) + CSRF double-submit |
| Workers | 3 workers BullMQ: IA processor, disaster sync, person matching |
| Vector search | Pinecone (opt-in) o Atlas Vector Search |
| Logs | Pino estructurado con redacción automática de PII |
| Monitoreo | Sentry + Bull Board UI |
| Tiempo real | Socket.IO con Redis adapter |
| Tests | Jest 30 + ts-jest + mongodb-memory-server + supertest |
| Despliegue | Render (Web Service + Background Worker) |

### Visión (`vision/`)

| Capa | Tecnología |
|---|---|
| Runtime | Python 3.11, FastAPI |
| Face Recognition | dlib + face_recognition (face encoding 128-d) |
| Age Estimation | Caffe DNN modelo preentrenado (age_net) |
| Despliegue | Docker (contenedor independiente) |

---

## Arquitectura

### Microservicios distribuidos

```
Usuario → Vercel (Frontend SPA)
              ↓ API proxy
         Render (API Express + Socket.IO)
              ↓
         ┌─────┼─────┐
         │     │     │
      MongoDB Redis  S3
      (Atlas) (Upstash) (Supabase)
         │     │
         │     └── BullMQ → Workers (IA, Matching, Disaster Sync)
         │
         └── Vision Service (Python/FastAPI)
```

### Flujo de ingesta de datos

```
Fuente externa → Adapter (normaliza) → Zod (valida) → sync-source.service
    → upsertPerson (idHash dedup) → PersonModel.bulkWrite
    → Outbox → person-matching (BullMQ) → matcher.service
            → ia-processing (BullMQ) → ia-processor.worker
            → geo-enrich (desastres cercanos)
```

### Flujo de reporte ciudadano

```
Usuario → ReportModal (7 pasos) → POST /api/persons → 202 Accepted
    → IA analiza texto (Anthropic/OpenAI/Gemini)
    → Vision extrae face encoding (si hay foto)
    → Reconciliation: busca duplicados
    → Matching: busca coincidencias con otras personas
    → Notifica vía Socket.IO
```

---

## Modelo de Datos

13 modelos Mongoose. El núcleo es `UnifiedPerson`:

| Modelo | Colección | Propósito |
|---|---|---|
| **UnifiedPerson** | `persons` | Personas desaparecidas/encontradas. Dedup por `idHash` SHA-256. |
| **User** | `users` | Usuarios con dual auth (Google + email/password), roles y tokenVersion. |
| **Match** | `matches` | Coincidencias entre reportes con score y workflow de revisión. |
| **DisasterEvent** | `disaster_events` | Desastres naturales con GeoJSON para cruce geoespacial. |
| **Localizado** | `localizados` | Personas en refugios y hospitales. |
| **SearchRequest** | `search_requests` | Solicitudes de búsqueda de familias con embedding vectorial. |
| **CaseContact** | `case_contacts` | Mensajes enmascarados entre usuarios (relé, sin exponer datos). |
| **ApiKey** | `api_keys` | Claves para integraciones machine-to-machine (SHA-256). |
| **Outbox** | `outboxes` | Transactional Outbox para eventos asíncronos (4 tipos). |
| **AuditLog** | `audit_logs` | Colección capped (1GB/1M docs) para auditoría admin. |
| **SyncState** | `sync_states` | Checksums MD5 para sincronización de fuentes. |
| **StateHistory** | `state_histories` | Historial inmutable de cambios de estado. |
| **VerificationRequest** | `verification_requests` | Solicitudes de rol verifier. |

---

## Desarrollo Local

### Requisitos

- Node.js 22+, npm
- Docker + Docker Compose

### Pasos

```bash
# 1. Clonar
git clone https://github.com/iacastillo90/ReencuentroTerremotoVenezuela.git
cd ReencuentroTerremotoVenezuela
cp back/.env.example back/.env

# 2. Infraestructura (MongoDB + Redis + MinIO + Vision)
docker compose up -d

# 3. Backend
cd back && npm install && npm run dev
# → http://localhost:4000

# 4. Frontend
cd front && npm install && npm run dev
# → http://localhost:5173
```

### Comandos útiles

```bash
# Backend
npm run dev              # Desarrollo (hot-reload)
npm run build            # Compilar TypeScript
npm start                # Producción (servidor)
npm run worker           # Worker standalone
npm test                 # Tests (Jest)
npm run reconcile        # Reconciliación manual

# Frontend
npm run dev              # Desarrollo (HMR)
npm run build            # Build producción
npm test                 # Tests (Vitest)
npm run lint             # Oxlint

# Docker
docker compose up -d              # Iniciar infraestructura
docker compose logs -f            # Logs en vivo
docker compose down               # Detener todo
```

---

## Variables de Entorno

Configurar en `back/.env`. Nunca subir al repositorio.

| Variable | Requerido | Descripción |
|---|---|---|
| `MONGO_URI` | Sí | Conexión a MongoDB |
| `REDIS_URL` | Sí | Conexión a Redis (colas + caché + Socket.IO) |
| `JWT_SECRET` | Sí* | Secreto JWT (obligatorio en producción) |
| `CORS_ORIGINS` | Sí | Orígenes CORS permitidos |
| `MINIO_ENDPOINT` | Depende | Endpoint de almacenamiento S3 |
| `MINIO_PORT` | Depende | Puerto S3 |
| `MINIO_ACCESS_KEY` | Depende | Access key S3 |
| `MINIO_SECRET_KEY` | Depende | Secret key S3 |
| `MINIO_BUCKET` | Depende | Bucket S3 |
| `AI_PROVIDER` | Depende | anthropic \| openai \| gemini |
| `ANTHROPIC_API_KEY` | Depende | API key Anthropic |
| `OPENAI_API_KEY` | Depende | API key OpenAI |
| `GEMINI_API_KEY` | Depende | API key Google Gemini |
| `ADMIN_API_KEY` | Depende | API key de administrador |
| `PARTNER_API_KEY` | Depende | API key para partners |
| `WEBHOOK_API_KEY` | Depende | Secreto para webhooks |
| `VISION_SERVICE_URL` | Depende | URL del microservicio Vision |
| `CSP_ENFORCE` | No | Activar modo enforce de CSP |
| `USE_PINECONE_VECTOR_SEARCH` | No | Activar búsqueda vectorial Pinecone |
| `USE_ATLAS_VECTOR_SEARCH` | No | Activar búsqueda vectorial Atlas |

> \* Generar JWT_SECRET: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

---

## API

### Públicas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Health check (MongoDB + Redis) |
| GET | `/api/persons` | Listar personas (paginado, ?q=, ?status=, ?category=, ?state=) |
| GET | `/api/persons/counts` | Estadísticas cacheadas (Redis TTL 5min) |
| POST | `/api/persons` | Reportar persona (con dedup por idHash) |
| GET | `/api/disasters` | Todos los desastres |
| GET | `/api/disasters/active` | Desastres activos |
| POST | `/api/search/vector` | Búsqueda semántica vectorial |
| GET | `/api/cne/:nationality/:cedula` | Consulta de cédula venezolana |
| GET | `/api/localizados` | Personas en refugios |
| GET | `/api/auth/csrf-token` | Siembra cookie CSRF |

### Autenticadas (JWT)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/persons/mine` | Mis reportes |
| POST | `/api/persons/:idHash/close` | Cerrar caso |
| POST | `/api/contact/send` | Enviar mensaje enmascarado |
| GET | `/api/contacts/sent` | Mensajes enviados |
| GET | `/api/contacts/received` | Mensajes recibidos |
| POST | `/api/search-requests` | Crear solicitud de búsqueda |
| GET | `/api/search-requests/mine` | Mis solicitudes |
| PATCH | `/api/search-requests/:id/status` | Actualizar estado |
| POST | `/api/media` | Subir archivo multimedia |
| POST | `/api/media/analyze-image` | Análisis de imagen con IA |
| POST | `/api/media/audio-transcribe` | Transcripción de audio (Whisper) |
| GET | `/api/matches/:reportId` | Matches de un reporte |

### Auth

| Método | Ruta | Rate Limit |
|---|---|---|
| POST | `/api/auth/google` | 5/15min |
| POST | `/api/auth/register` | 10/15min |
| POST | `/api/auth/login` | 5/15min |
| GET | `/api/auth/me` | — |
| POST | `/api/auth/profile` | — |
| POST | `/api/auth/logout` | — |

### Integración (API Key)

| Método | Ruta | Auth |
|---|---|---|
| GET/POST | `/api/partner/cases` | `x-partner-api-key` |
| POST | `/api/localizados` | `x-partner-api-key` |
| POST | `/api/webhooks/n8n/whatsapp` | `x-webhook-api-key` |
| POST | `/api/webhooks/n8n/telegram` | `x-webhook-api-key` |

### Admin (API Key)

| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/api/admin/persons` | CRUD personas |
| PATCH | `/api/admin/persons/:idHash/status` | Cambiar estado |
| POST | `/api/admin/merge/:id1/:id2` | Fusionar perfiles |
| POST | `/api/admin/audit/:jobId/merge` | Aprobar merge |
| POST | `/api/admin/audit/:jobId/dismiss` | Descartar merge |
| GET | `/api/admin/users` | Gestión usuarios |
| PATCH | `/api/admin/users/:id/role` | Cambiar rol |
| GET | `/api/admin/searches` | Historial búsquedas |
| POST | `/api/admin/api-keys` | Crear API key |
| GET | `/api/admin/queues` | Bull Board UI |

---

## Seguridad

### Capas de defensa

| Capa | Implementación |
|---|---|
| Helmet | HTTP security headers, CSP, HSTS |
| CORS | Allowlist exacta, coincidencia subdominio a subdominio |
| Rate limiting | 500 req/15min global, 5-10 req/15min en auth |
| CSRF | Double-submit cookie + header, timingSafeEqual |
| Zod | Toda entrada validada (tipos, longitudes, sanitización) |
| sanitize-html | Stripea etiquetas HTML (`allowedTags: []`) |
| Magic bytes | file-type library verifica tipo real de archivos subidos |
| PII redaction | Pino redacta passwords, tokens, cédulas, teléfonos |
| Mongoose select:false | Embeddings y face encodings nunca expuestos por defecto |
| idHash | SHA-256 determinístico, no expone IDs externos |
| Contact relay | Mensajes entre usuarios sin revelar datos de contacto |
| LOPNNA | Protección de menores: nombres enmascarados, moderación especial |
| tokenVersion | Revocación de sesión: incrementa versión, invalida JWT |
| safeRegexQuery | Previene ReDoS en búsquedas $regex |

### Roles de usuario

| Rol | Acceso |
|---|---|
| `user` | Reportar, buscar, ver feed/mapa |
| `verifier` | Puede verificar reportes (periodistas, ONGs) |
| `admin` | Panel completo: cambios de estado, merge, gestión de usuarios |

---

## Documentación

| Documento | Contenido |
|---|---|
| [`DOCUMENTACION_BACK.md`](DOCUMENTACION_BACK.md) | Documentación completa del backend (español, narrativa técnica) |
| [`DOCUMENTACION_FRONT.md`](DOCUMENTACION_FRONT.md) | Documentación completa del frontend (español, narrativa técnica) |
| [`DEVELOPERS.md`](DEVELOPERS.md) | Guía técnica para desarrolladores |
| [`TDD.md`](TDD.md) | Documento de diseño técnico detallado |
| [`Integraciones.md`](Integraciones.md) | Manual de integración de fuentes externas |
| [`AGENTS.md`](AGENTS.md) | Instrucciones para asistentes IA |
| `back/AGENTS.md` | Instrucciones del backend |
| `front/AGENTS.md` | Instrucciones del frontend |
| `vision/AGENTS.md` | Instrucciones del microservicio de visión |

---

## Contribuir

1. Fork del repositorio
2. Rama: `git checkout -b feature/mi-cambio`
3. Seguir convenciones: TypeScript strict, Zod validation, tests
4. Para cambios grandes, seguir flujo SDD: `sdd-propose` → `sdd-design` → `sdd-tasks` → `sdd-apply` → `sdd-verify`
5. Verificar 0 errores TypeScript: `cd back && npx tsc --noEmit`
6. Verificar tests: `npm test`
7. PR con conventional commits

### Convenciones

- **Commits**: `tipo(scope): mensaje` — ej. `feat(back): add rate limiting to person routes`
- **Branches**: `feature/`, `fix/`, `security/`, `refactor/`
- **Código**: español. **Commits**: inglés.

---

## Licencia

MIT. Ver archivo `LICENSE`.

---

*Reencuentro Terremoto Venezuela — hecho con profundo compromiso técnico y humano.*