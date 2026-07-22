# Guía de Integraciones — Reencuentro Terremoto Venezuela

Diagrama de arquitectura, flujos entre servicios, dependencias externas, integración de datos, y procedimientos de mantenimiento para las integraciones del proyecto.

---

## Arquitectura General

```
┌──────────┐     ┌──────────────┐     ┌───────────┐
│  Cliente  │ ──► │  Frontend    │ ──► │  Backend  │
│ (Browser) │     │  (Vercel)    │     │  (Render) │
└──────────┘     └──────────────┘     └─────┬─────┘
                                           │
                    ┌───────────────────────┼───────────────────┐
                    │                       │                   │
               ┌────▼─────┐          ┌──────▼──────┐    ┌──────▼──────┐
               │ MongoDB  │          │   Redis     │    │   MinIO    │
               │  (Render)│          │  (Render)   │    │ (Supabase) │
               └──────────┘          └─────────────┘    └─────────────┘
                                           │
                                    ┌──────▼──────┐
                                    │   Worker    │
                                    │  (Render)   │
                                    └─────────────┘

┌──────────┐     ┌──────────────┐
│ Visión   │ ◄──►│   Backend    │
│ (Python) │     │   (REST)     │
└──────────┘     └──────────────┘

┌──────────────┐     ┌──────────────┐
│ N8N Webhook  │ ──► │   Backend    │
│ (WhatsApp/   │     │   (POST)     │
│  Telegram)   │     └──────────────┘
└──────────────┘

┌──────────────┐
│ Fuentes      │ ◄── Scrapers programados cada 15-60 min
│ Externas     │     (14 scrapers en jobs/)
└──────────────┘
```

---

## Dependencias Externas

| Servicio | Uso | Plan/Tier | Costo |
|---|---|---|---|
| **MongoDB Atlas** o Render Mongo | Base de datos principal (7.0) | Free (512MB) / $7/mo | — |
| **Redis** (Render) | Caché, colas BullMQ, sesiones Socket.IO | Free (30MB) | — |
| **Supabase Storage** (S3 compatible) | Fotos de personas, audios, documentos | Free (1GB) | — |
| **Google OAuth** | Autenticación de usuarios | Gratuito | — |
| **Anthropic Claude API** | Análisis semántico de reportes | Pay-per-use | ~$0.03/reporte |
| **OpenAI API** | Embeddings text-embedding-3-small + Whisper | Pay-per-use | ~$0.001/llamada |
| **Google Gemini API** | Análisis alternativo de imágenes | Pay-per-use (free tier 60 req/min) | — |
| **Sentry** | Error tracking + performance | Free (5k events/mes) | — |
| **Vercel** | Hosting frontend (SPA) | Free (Hobby) | — |
| **Render** | Hosting backend + worker + BD + Redis | Free/Paid | — |
| **N8N (self-hosted)** | Automatización WhatsApp/Telegram | Self-hosted | VPS propio |
| **CNE API** | Consulta de cédula venezolana | Pública | Gratuito |

---

## Integración de IA

### Arquitectura Multi-Provider

El sistema de IA usa un **factory pattern** para soportar múltiples proveedores.

| Provider | Endpoint | Propósito |
|---|---|---|
| Anthropic Claude | `POST /v1/messages` | Análisis semántico, extracción estructurada de datos de reportes |
| OpenAI | `POST /v1/embeddings` | Generación de embeddings (text-embedding-3-small, 512d) |
| OpenAI | `POST /v1/audio/transcriptions` | Transcripción de audios (Whisper) |
| Google Gemini | `POST /v1/models` | Análisis de imágenes alternativo |

### Flujo de procesamiento con IA

```
1. Usuario crea reporte (POST /api/persons)
2. Backend encola job en cola "ia-process"
3. Worker IA recibe el job:
   a. Descarga imágenes desde MinIO
   b. Envía a Anthropic Claude para extracción estructurada
   c. Genera embedding con OpenAI (text-embedding-3-small)
   d. Guarda embedding en el documento Persona
   e. Encola job en cola "person-matching"
4. Worker matching ejecuta búsqueda vectorial (cosine similarity)
5. Si encuentra match > umbral, notifica al usuario via Socket.IO
```

### Variables de Entorno

| Variable | Dónde se usa |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic provider |
| `OPENAI_API_KEY` | OpenAI provider (embeddings + whisper) |
| `GEMINI_API_KEY` | Google Gemini provider |

---

## Integración de Datos Externos (Scrapers)

### Jobs de scraping de desastres (14 jobs, 9 scrapean fuentes externas)

| # | Job | Propósito | Fuente Externa | Tipo de fetch |
|---|---|---|---|---|
| 1 | `usgs.job.ts` | Sismos activos (≥2.5 en Venezuela) | USGS Earthquake API (GeoJSON) | HTTP API |
| 2 | `funvisis.job.ts` | Sismos recientes | FUNVISIS API (/api/sismos/recientes) | HTTP API |
| 3 | `gdacs.job.ts` | Alertas globales de desastre | GDACS RSS feed | RSS |
| 4 | `firms.job.ts` | Incendios satelitales (VIIRS) | NASA FIRMS API | HTTP API (CSV) |
| 5 | `inameh.job.ts` | Alertas meteorológicas | INAMEH web (Cheerio) | HTML scrape |
| 6 | `corpoelec.job.ts` | Cortes de luz | CORPOELEC web (Cheerio) | HTML scrape |
| 7 | `dtv.job.ts` | Reportes de personas | desaparecidosterremotovenezuela.com (Puppeteer) | Headless browser |
| 8 | `reencuentro.job.ts` | Personas de plataforma hermana | Reencuentro/ApoyaVe API | HTTP API |
| 9 | `venezuelareporta.job.ts` | Personas de plataforma hermana | VenezuelaReporta API | HTTP API |
| 10 | `lopnna-sweep.job.ts` | Barrido LOPNNA (detección de menores) | Visión microservicio (interno) | — |
| 11 | `biometric-sweep.job.ts` | Encoding facial + dedup biométrico | Visión microservicio (interno) | — |
| 12 | `reconcile.job.ts` | Crossover geoespacial + fuzzy matching | BD interna | — |
| 13 | `cruz-roja.job.ts` | Alertas médicas / donaciones | Mock data (TODO: API real) | — |
| 14 | `proteccion-civil.job.ts` | Alertas de protección civil | Placeholder (TODO) | — |

Las 9 fuentes externas se ejecutan con node-cron y alimentan la colección `DisasterEvent`. Los 3 jobs de desastres naturales (USGS, Funvisis, GDACS, FIRMS, INAMEH, CORPOELEC) orquestan desde la cola `disaster-sync`. Los jobs de personas (DTV, Reencuentro, VenezuelaReporta) llaman adaptadores dedicados.

### Jobs de sincronización de personas (adapters)

| Adapter | Conecta a | Propósito |
|---|---|---|
| `ReencuentroAdapter` | Reencuentro/ApoyaVe API | Normaliza campos de persona |
| `VenezuelaReportaAdapter` | VenezuelaReporta API | Normaliza campos de persona |
| `VenezuelaTeBuscaAdapter` | Venezuela Te Busca platform | Normaliza campos de persona |
| `WebFormAdapter` | Formulario web público | Normaliza reportes directos |

### Flujo de sincronización

```
1. Job programado (node-cron) se ejecuta según su frecuencia
2. Si el job es de desastres:
   a. Fetch HTTP / RSS / HTML a la fuente externa
   b. Parseo (JSON, GeoJSON, CSV, XML, HTML según la fuente)
   c. Normalización al schema DisasterEvent
   d. Cálculo de checksum MD5 del contenido
   e. Comparación contra SyncState (último checksum conocido)
   f. Si cambió: upsert en MongoDB + emisión Socket.IO
3. Si el job es de personas:
   a. Fetch vía adapter (ISourceAdapter)
   b. Normalización al schema UnifiedPerson
   c. Dedup por idHash (SHA-256)
   d. Inserción/actualización en MongoDB
4. Si el job es interno (biométrico, LOPNNA, reconcile):
   a. Consulta Vision microservicio o BD interna
   b. Actualiza registros según resultado
5. Logging estructurado con Pino (source, checksum, cambios detectados)
```

### Estructura de un job de scraper

```typescript
// back/src/jobs/usgs.job.ts
import { Job } from 'bullmq';
import { checkSyncState, updateSyncState } from '../services/sync-state';

export async function usgsScraper(job?: Job) {
  const response = await fetch(
    'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
    '&minmagnitude=2.5&minlatitude=0&maxlatitude=15&minlongitude=-75&maxlongitude=-58'
  );
  const data = await response.json();
  const events = data.features.map(normalizeUsgsEvent);
  const checksum = computeChecksum(events);

  const state = await checkSyncState('usgs', checksum);
  if (state.hasChanged) {
    await DisasterEvent.bulkWrite(/* ...upsert... */);
    await updateSyncState('usgs', checksum);
    notifyClients(events);
  }
}
```

---

## Sincronización de Desastres (Disaster Sync)

### Worker

| Propiedad | Valor |
|---|---|
| Cola | `disaster-sync` |
| Worker | `disaster-sync.worker.ts` |
| Concurrency | 3 (máximo 3 fuentes simultáneas) |
| Default job options | `removeOnComplete: 100`, `removeOnFail: 500` |

### Modelo SyncState

La tabla `sync_states` guarda el último checksum por fuente:

```typescript
interface SyncState {
  source: string;      // 'usgs', 'funvisis', etc.
  checksum: string;    // MD5 hash del último contenido procesado
  lastSync: Date;
  lastChange: Date;
}
```

Si el checksum actual coincide con el almacenado, se omite el upsert (no hay cambios). Esto evita escrituras innecesarias y reduce carga en MongoDB.

---

## Matching Vectorial y Facial

### Flujo de matching

```
1. Se crea o actualiza una persona (vía API directa o worker IA)
2. Se encola job en cola "person-matching"
3. Worker matching:
   a. Recupera embedding 512-d de la persona
   b. Búsqueda de similitud coseno contra todas las personas activas
   c. Si hay imágenes: extrae encoding facial (vía visión microservice)
   d. Cruza resultados vectoriales + faciales
   e. Si score > 0.85: crea Match con status "auto-approved"
   f. Si score > 0.60: crea Match con status "pending" (auditoría humana)
   g. Si score > 0.40: registra en cola "manual-audit" para revisión
4. Si hay match pendiente: notifica al admin via Socket.IO
5. Admin aprueba/rechaza desde el panel (PATCH /api/admin/matches/:id/status)
```

### Parámetros de matching

| Parámetro | Valor | Descripción |
|---|---|---|
| `VECTOR_WEIGHT` | 0.6 | Peso de similitud de embeddings |
| `FACIAL_WEIGHT` | 0.4 | Peso de similitud facial (si hay fotos) |
| `AUTO_APPROVE_THRESHOLD` | 0.85 | Match automático |
| `PENDING_THRESHOLD` | 0.60 | Requiere verificación humana |
| `AUDIT_THRESHOLD` | 0.40 | Auditoría manual |

---

## Webhooks (N8N)

### Endpoints

| Ruta | Método | Auth | Propósito |
|---|---|---|---|
| `/api/webhooks/n8n/whatsapp` | POST | Webhook API Key | Mensajes entrantes de WhatsApp |
| `/api/webhooks/n8n/telegram` | POST | Webhook API Key | Mensajes entrantes de Telegram |

### Integración con N8N

```
[WhatsApp Cloud API] ──► [N8N Webhook] ──► [Backend /api/webhooks/n8n/whatsapp]
                                                       │
                                                       ▼
                                              [CaseContact creado]
                                                       │
                                                       ▼
                                              [Socket.IO emite al destinatario]
```

---

## Partners (Integración con ONGs/Gobierno)

### Endpoints

| Ruta | Método | Auth | Propósito |
|---|---|---|---|
| `/api/partners/cases` | GET | Partner API Key | Listar casos activos |
| `/api/partners/cases` | POST | Partner API Key | Reportar casos desde sistema externo |

### Flujo de integración partner

1. ONG/entidad solicita API key al administrador.
2. Administrador crea API key desde `GET /api/admin/api-keys` y entrega la key en texto plano (no se almacena; solo su hash SHA-256).
3. Partner envía `x-partner-api-key` en header en cada request.
4. Backend verifica hash contra BD.
5. Partner puede consultar casos activos y reportar nuevos desde su sistema.

---

## Partners con LOPNNA (Ley Orgánica de Protección del Niño, Niña y Adolescente)

### Endpoints

| Ruta | Método | Auth | Propósito |
|---|---|---|---|
| `/api/localizados` | GET | Público | Consultar localizados |
| `/api/localizados` | POST | Partner API Key | Registrar localizado |

### Canal de difusión

Los localizados se difunden vía Socket.IO en el room `lopnna`:

```typescript
io.to('lopnna').emit('localizado:new', { /* datos anonimizados */ });
```

Esto permite que organismos de protección infantil reciban notificaciones en tiempo real sin exponer datos sensibles.

---

## Partners con CNE (Consejo Nacional Electoral)

### Endpoints

| Ruta | Método | Auth | Propósito |
|---|---|---|---|
| `/api/cne/:nationality/:cedula` | GET | Público | Consultar datos de cédula |

### Implementación

- Proxy a la API pública del CNE venezolano.
- Cachea resultados en Redis por 24 horas (TTL: 86400s).
- Sanitiza entrada para evitar inyección.
- Rate limiting: 30 req/min por IP.

---

## Partners con Defensa Civil

### Endpoints

| Ruta | Método | Auth | Propósito |
|---|---|---|---|
| `/api/logistics/alerts` | POST | Partner API Key | Crear alerta logística |
| `/api/logistics/alerts` | GET | Público | Consultar alertas activas |

### Flujo

1. Defensa Civil recibe alerta de damnificados en una zona.
2. Crea alerta logística vía API.
3. Alerta se difunde en el Feed y en el panel de Logística.
4. Usuarios pueden confirmar recepción de ayuda.

---

## Partners con Medios de Comunicación

### Endpoints

| Ruta | Método | Auth | Propósito |
|---|---|---|---|
| `/api/persons` | GET | Público | Consultar personas (filtrable) |
| `/api/persons/counts` | GET | Público | Estadísticas agregadas |
| `/api/disasters/active` | GET | Público | Desastres activos |
| `/api/search-requests/mine` | GET | Usuario | Solicitudes de búsqueda |

### Uso de Cache

| Endpoint | Cache | TTL |
|---|---|---|
| `/api/persons` | No (datos pueden cambiar) | — |
| `/api/persons/counts` | Redis | 5 min |
| `/api/disasters/active` | Redis | 5 min |
| `/api/cne/:nationality/:cedula` | Redis | 24 h |

---

## Partners con Servicios Forenses

### Endpoints

| Ruta | Método | Auth | Propósito |
|---|---|---|---|
| `/api/matches/:reportId` | GET | Usuario (owner) | Consultar matches de un reporte |
| `/api/admin/persons/:idHash/moderate` | PATCH | Admin | Moderar contenido sensible |

### Procedimiento

1. Servicio forense accede como usuario verifier.
2. Consulta matches de un reporte específico.
3. Si hay coincidencia, coordina con el administrador para cerrar el caso.
4. El cierre de caso activa notificación a todas las partes involucradas.

---

## Partners con Alcaldías y Gobernaciones

### Endpoints

| Ruta | Método | Auth | Propósito |
|---|---|---|---|
| `/api/persons?state=:state` | GET | Público | Filtrar por estado |
| `/api/logistics/alerts?state=:state` | GET | Público | Alertas por estado |

### Flujo

1. Alcaldía consulta personas reportadas en su jurisdicción.
2. Filtra por estado (Miranda, Lara, etc.).
3. Puede coordinar logística de búsqueda desde el panel de Administración.

---

## Partners con Cruz Roja y Organismos Humanitarios

### Endpoints

| Ruta | Método | Auth | Propósito |
|---|---|---|---|
| `/api/persons` | GET | Público | Consulta general |
| `/api/persons?status=found` | GET | Público | Personas localizadas |
| `/api/contacts/send` | POST | Usuario | Contactar a reportante |

### Flujo

1. Cruz Roja accede a la plataforma como usuario verifier.
2. Consulta personas localizadas para coordinar reunificación familiar.
3. Usa el sistema de contactos enmascarados para comunicarse con reportantes.
4. Reporta novedades desde el terreno vía app móvil o web.

---

## Partners con Autoridades de Migración (SAIME)

### Endpoints

| Ruta | Método | Auth | Propósito |
|---|---|---|---|
| `/api/localizados` | GET | Público | Consultar localizados |
| `/api/persons` | GET | Público | Consultar personas |

### Flujo

1. Autoridad migratoria accede a la plataforma.
2. Verifica si personas reportadas han salido del país.
3. Coordina con el equipo para actualizar el estado.

---

## Partners con el Sistema de Salud (Hospitales/Clínicas)

### Endpoints

| Ruta | Método | Auth | Propósito |
|---|---|---|---|
| `/api/localizados` | POST | Partner API Key | Registrar pacientes |
| `/api/localizados` | GET | Público | Consultar pacientes |

### Flujo

1. Hospital recibe paciente no identificado.
2. Registra en la plataforma como localizado (con datos anonimizados).
3. El sistema cruza automáticamente con reportes de desaparición.
4. Si hay coincidencia, notifica al reportante via Socket.IO y email.

---

## Partners con el Sistema Educativo (Ministerio de Educación)

### Endpoints

| Ruta | Método | Auth | Propósito |
|---|---|---|---|
| `/api/persons` | GET | Público | Consultar menores reportados |
| `/api/persons?category=children` | GET | Público | Filtrar por menores |

### Flujo

1. Ministerio consulta menores reportados como desaparecidos.
2. Cruza con registros escolares para identificar posibles localizados.
3. Reporta hallazgos a la plataforma.

---

## Partners con la FANB (Fuerza Armada Nacional Bolivariana)

### Endpoints

| Ruta | Método | Auth | Propósito |
|---|---|---|---|
| `/api/logistics/alerts` | GET | Público | Alertas logísticas |
| `/api/persons` | GET | Público | Consulta general |

### Flujo

1. FANB recibe alerta de damnificados en una zona.
2. Moviliza recursos de búsqueda y rescate.
3. Reporta personas encontradas vía partner API.

---

## Mantenimiento de Integraciones

### Verificar estado de webhooks

```bash
curl -X POST https://api.reencuentro.vercel.app/api/webhooks/n8n/whatsapp \
  -H "x-webhook-api-key: $WEBHOOK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Probar adaptador de scraper

```bash
cd back && npx tsx src/jobs/usgs.scraper.ts  # Ejecutar scraper individual
```

### Monitorear colas

```bash
# Ver estado de todas las colas
curl -X GET https://api.reencuentro.vercel.app/api/admin/queues \
  -H "x-api-key: $ADMIN_API_KEY"
```

### Logs de integración

Los logs de integraciones están en formato Pino estructurado. Filtrar por integración:

```bash
docker compose logs api | jq 'select(.integration == "usgs")'
docker compose logs worker | jq 'select(.queue == "disaster-sync")'
```

### Troubleshooting común

| Síntoma | Causa probable | Solución |
|---|---|---|
| Scraper no trae datos | Fuente externa caída o cambio de API | Verificar URL en adapter, revisar logs |
| Webhook no responde | API Key inválida o expirada | Regenerar key desde `/api/admin/api-keys` |
| Matching no encuentra nada | Embedding no generado | Revisar worker IA, verificar API key de OpenAI |
| Socket.IO no notifica | Redis desconectado | Verificar conexión Redis, reiniciar worker |
| Imágenes no cargan | MinIO/Supabase caído | Verificar credenciales S3, revisar bucket |
| 403 en requests | CSRF token inválido | Refrescar página para obtener nuevo token |

### Migraciones y actualizaciones

Al cambiar la estructura de datos:

1. Actualizar el modelo Mongoose correspondiente.
2. Actualizar el adaptador/scraper si aplica.
3. Actualizar el validador Zod.
4. Actualizar la interfaz `ISourceAdapter` si el cambio es transversal.
5. Ejecutar migración si es necesario (ver `back/scripts/`).
6. Verificar que los tests de integración pasan.