# Guía de Integraciones
**Proyecto:** Reencuentro Terremoto Venezuela

---

## 1. Introducción

El valor principal de la plataforma es consolidar información de múltiples fuentes caóticas en una única base de datos centralizada. Este documento cubre **todas** las integraciones del sistema: ingesta de datos, autenticación, almacenamiento, IA, webhooks, partners y más.

---

## 2. Arquitectura de Ingesta

Todas las integraciones siguen un pipeline de 4 capas:

```
Fuente Externa (API, CSV, Webhook, Scraper)
    ↓
Adapter (normaliza al schema interno)  →  back/src/adapters/
    ↓
Validador Zod (tipos, longitudes, sanitización)  →  back/src/validators/
    ↓
Sync Service (dedup + upsert + outbox)  →  back/src/services/sync-source.service.ts
    ↓
MongoDB (UnifiedPerson / Localizado)
    ↓
Workers (matching, IA, notificaciones)  →  back/src/workers/
```

### Idempotencia Garantizada

Cada registro lleva un `idHash` criptográfico (SHA-256 de `source + externalId`). El upsert usa este hash como filtro: si existe, actualiza; si no, crea. Esto permite ejecutar el mismo scraper N veces sin duplicar datos.

El sistema incluye una capa adicional de dedup vía `SyncState` (checksum MD5) que detecta si el payload cambió realmente antes de escribir:

```
back/src/services/sync-state.service.ts
  → generateChecksum(payload)
  → checkSyncState(source, externalId, payload)
  → markSyncSuccess / markSyncError
```

---

## 3. Scrapers Programados (12 fuentes)

Ejecutados por el worker `disaster-sync.worker.ts` vía cola BullMQ `disaster-sync`. Orquestados con `node-cron` en `back/src/jobs/`.

| Fuente | Archivo | Tipo | Descripción |
|---|---|---|---|
| USGS | `jobs/usgs.job.ts` | API | Sismos globales (US Geological Survey) |
| FIRMS | `jobs/firms.job.ts` | API | Incendios activos satelitales (NASA) |
| GDACS | `jobs/gdacs.job.ts` | API | Alertas globales de desastres (UN/UE) |
| FUNVISIS | `jobs/funvisis.job.ts` | API | Sismología venezolana |
| INAMEH | `jobs/inameh.job.ts` | API | Clima e hidrometeorología Venezuela |
| CORPOELEC | `jobs/corpoelec.job.ts` | API | Cortes eléctricos Venezuela |
| Protección Civil | `jobs/proteccion-civil.job.ts` | Web | Alertas de PC Venezuela |
| Cruz Roja | `jobs/cruz-roja.job.ts` | Web | Reportes Cruz Roja Venezuela |
| DTV | `jobs/dtv.job.ts` | API | Fuente DTV |
| Reencuentro API | `jobs/reencuentro.job.ts` | API | Propia API de Reencuentro |
| Venezuela Reporta | `jobs/venezuelareporta.job.ts` | API | Reportes Venezuela Reporta |
| Reconciliación | `jobs/reconcile.job.ts` | Interno | Trigger manual de reconciliación |

### Cómo agregar un scraper nuevo

1. Crear archivo en `back/src/jobs/mi-fuente.job.ts`
2. Implementar la función de fetch + mapeo
3. Usar `sync-source.service.ts` para la carga (dedup automático):

```typescript
import { syncFromSource } from '../services/sync-source.service';

export async function fetchMiFuente() {
  const items = await fetch('https://api.example.com/data').then(r => r.json());

  await syncFromSource(items, {
    source: 'mi-fuente',
    chunkSize: 100,
    onItem: (item: any) => ({
      name: item.nombre,
      status: item.estado === 'encontrado' ? 'found' : 'missing',
      'lastSeen.state': item.estado_ubicacion,
      // ...mapeo al schema UnifiedPerson
    })
  });
}
```

4. Registrar en `disaster-sync.worker.ts` o en `server.ts` con `node-cron`.

---

## 4. Adapters (Normalización de Datos)

Los adapters transforman datos de formatos externos al schema interno estandarizado. Implementan la interfaz `ISourceAdapter<T>`:

```
back/src/adapters/
├── base.adapter.ts           # Interfaz ISourceAdapter<T>
├── factory.adapter.ts        # Registry + factory (getAdapter, registerAdapter)
├── reencuentro.adapter.ts    # Normaliza datos de API Reencuentro
├── venezuelareporta.adapter.ts  # Normaliza datos Venezuela Reporta
├── venezuela-te-busca.adapter.ts  # Normaliza datos Venezuela Te Busca
└── web-form.adapter.ts       # Normaliza formularios web
```

### Flujo de uso

```typescript
const adapter = getAdapter('reencuentro');
const normalized = adapter.normalize(rawData);
// normalized ahora sigue el schema PersonPayload (Zod validado)
```

---

## 5. Webhooks (Tiempo Real)

### WhatsApp (n8n)

Endpoint: `POST /api/webhooks/n8n/whatsapp`
Auth: Header `x-webhook-api-key`

n8n envía mensajes de WhatsApp entrantes. El payload se valida con Zod (`webhookWhatsAppSchema`) y se encola para procesamiento IA.

### Telegram (n8n)

Endpoint: `POST /api/webhooks/n8n/telegram`
Auth: Header `x-webhook-api-key`

Mismo patrón que WhatsApp. El mensaje de Telegram se valida y encola.

### Ejemplo de implementación de webhook

```typescript
// back/src/routes/webhooks.route.ts
router.post('/n8n/whatsapp', requireWebhookApiKey, validateBody(webhookWhatsAppSchema), async (req, res) => {
  const { text, from } = req.body;
  await addJobToIAQueue({ source: 'whatsapp', externalId: from, rawText: text });
  res.status(202).json({ ok: true });
});
```

---

## 6. Partners API

Endpoint: `POST /api/partners/cases` y `GET /api/partners/cases`
Auth: Header `x-partner-api-key`

Para organizaciones externas (ONGs, gobiernos) que integran sus sistemas con Reencuentro. El payload se valida con Zod (`partnerCaseSchema`) y se upserea como `UnifiedPerson`.

```typescript
POST /api/partners/cases
Content-Type: application/json
x-partner-api-key: pk_abc123

{
  "cases": [
    {
      "externalId": "CS-2024-001",
      "name": "María Pérez",
      "estado": "Lara",
      "status": "missing",
      "lastSeen": "2024-08-15",
      "photoUrl": "https://..."
    }
  ]
}
```

---

## 7. Localizados (Personas en Refugios)

Endpoint: `POST /api/localizados` y `GET /api/localizados`
Auth POST: Header `x-partner-api-key`
Auth GET: Público

Para ingestar datos de personas localizadas en refugios, hospitales y albergues. Soporta inserción masiva con `ordered: false` (tolera duplicados).

```typescript
POST /api/localizados
x-partner-api-key: pk_abc123

[
  {
    "name": "Juan Díaz",
    "cedula": "V-12345678",
    "location": "Refugio La Vega, Parroquia La Vega, Caracas",
    "contactNumber": "0412-1234567",
    "status": "localizado"
  }
]
```

---

## 8. AI / Procesamiento Inteligente

### Proveedores

Multi-proveedor seleccionable por `AI_PROVIDER` env var:

```
back/src/services/ai/
├── ai.interface.ts       # Interfaz IAIProvider + tipos comunes
├── ai.factory.ts         # Factory (selecciona según env var)
├── anthropic.service.ts  # Implementación Anthropic Claude
├── openai.service.ts     # Implementación OpenAI GPT
└── gemini.service.ts     # Implementación Google Gemini
```

### Cola de Procesamiento IA

Cuando un reporte llega sin estructura (WhatsApp, Telegram, texto libre), se encola en `ia-process` (BullMQ):

```typescript
import { addJobToIAQueue } from '../queues/ia-process.queue';

await addJobToIAQueue({
  source: 'whatsapp-bot',
  externalId: 'msg-99238',
  rawText: "Busco a mi mamá Carmen Lopez, tiene 65 años, se perdió en Mérida",
  date: new Date()
});
```

El worker `ia-processor.worker.ts`:
1. Toma el mensaje de la cola Redis
2. Llama al proveedor IA configurado
3. Extrae datos estructurados (nombre, edad, ubicación, etc.)
4. Reconoce y consolida en `UnifiedPerson`
5. Genera embedding vectorial para búsqueda semántica
6. Notifica vía Socket.IO

### Búsqueda Vectorial

Endpoint: `POST /api/search/vector`

Usa Pinecone para búsqueda por similitud semántica. El texto de búsqueda se convierte en embedding y se compara con los embeddings de todas las personas:

```
back/src/services/pinecone.service.ts
  → upsertVectorToPinecone(id, embedding, metadata)
  → queryPinecone(embedding, topK)
```

---

## 9. Sistema de Reconciliación y Matching

### Pipeline de Dedup

```
Persona nueva/actualizada
    ↓
Encola person-matching (BullMQ)
    ↓
matcher.service → embedding + cosine similarity
    ↓
Score > 95%   → Auto-merge (reconciliation.service)
Score > 85%   → Encola manual-audit (revisión humana)
Score < 85%   → No hace nada
```

### Servicios

- `back/src/services/matcher.service.ts` — Motor de matching (cosine similarity + vector search)
- `back/src/services/reconciliation.service.ts` — Dedup pipeline con auto-merge y auditoría
- `back/src/services/fuzzy-match.util.ts` — Fuzzy name matching (`calculateSimilarity`)

### Auditoría Humana

Endpoints admin:
- `GET /api/admin/audit` — Lista posibles duplicados
- `POST /api/admin/audit/:jobId/merge` — Aprobar fusión
- `POST /api/admin/audit/:jobId/dismiss` — Descartar

---

## 10. Autenticación Externa

### Google OAuth

Frontend: `@react-oauth/google` — componente `<GoogleLogin />` que devuelve credential token.

Backend: `POST /api/auth/google` — verifica con `google-auth-library`, busca/crea usuario, emite JWT.

```typescript
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const ticket = await client.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
const payload = ticket.getPayload();
// payload.sub, payload.email, payload.name, payload.picture
```

### API Keys (Machine-to-Machine)

Tres tipos de API keys para integraciones automatizadas:

| Tipo | Header | Uso | Hash |
|---|---|---|---|
| admin | `x-api-key` | Endpoints `/api/admin` | SHA-256 |
| webhook | `x-webhook-api-key` | Endpoints `/api/webhooks` | SHA-256 |
| partner | `x-partner-api-key` | `/api/partners`, `POST /api/localizados` | SHA-256 |

Se almacenan hasheadas en `ApiKey` model. También soporte legacy via env vars con `timingSafeEqual`.

```typescript
// Crear API key (admin dashboard o script)
POST /api/admin/api-keys
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "name": "Integración Cruz Roja",
  "type": "partner",
  "expiresAt": "2025-12-31"
}
```

---

## 11. Almacenamiento (Media/S3)

Compatible con Supabase Storage, MinIO, o cualquier S3-compatible:

```typescript
back/src/services/storage.service.ts
  → uploadMedia(buffer, name, mime)       // Subir archivo
  → getPresignedUrl(key)                   // URL temporal de descarga
  → getPresignedUploadUrl(key)             // URL temporal de subida directa
```

Usado por:
- `POST /api/media` — Subir fotos de personas
- `POST /api/media/analyze-image` — Análisis de imagen con IA
- `POST /api/media/audio-transcribe` — Transcripción de audio (Whisper)

---

## 12. Consulta CNE (Cédula Venezolana)

Endpoint público: `GET /api/cne/:nationality/:cedula`

Integración con el Consejo Nacional Electoral venezolano para verificación de datos de identidad.

---

## 13. Socket.IO (Tiempo Real)

```typescript
back/src/services/socket.service.ts
  → initializeSocketServer(httpServer, origins)
  → emitToUser(userId, event, data)
```

Usos:
- Notificar admin cuando hay nuevos matches pendientes
- Notificar usuario cuando su reporte tiene match
- Chat en tiempo real entre usuarios

Frontend se conecta solo cuando hay sesión activa:

```typescript
// front/src/store/SocketContext.tsx
const socket = io(VITE_API_URL, { withCredentials: true, auth: { token } });
```

---

## 14. Outbox Pattern (Eventos Asíncronos)

Para eventos que deben procesarse de manera confiable:

```typescript
back/src/services/outbox.service.ts
  → addToOutbox(type, payload)
  → processOutbox()
```

Tipos de eventos:
- `matching` — Procesar matching para persona nueva
- `audit` — Enviar a auditoría humana
- `ia-process` — Procesar con IA
- `geo-enrich` — Enriquecer con datos geoespaciales

---

## 15. Integración con Frontend: Contacto Enmascarado

Cuando un usuario quiere contactar al reportante de una persona, el mensaje pasa por el servidor:

```
Usuario A → POST /api/contacts → servidor → encuentra reportante B
    → guarda mensaje en CaseContact
    → (futuro: notifica a B vía email/Socket.IO)
    → B nunca ve datos de contacto de A
```

```typescript
// back/src/services/contact.service.ts
async function createContact(reportId: string, senderId: string, message: string, receiverId: string) {
  return CaseContactModel.create({
    reportId,
    senderId,
    message,
    receiverId,
    status: 'pending',
    encrypted: false // futuro: cifrado extremo a extremo
  });
}
```

---

## 16. Guía Rápida: Agregar una Integración Nueva

### Paso 1: Determinar el tipo

| Si los datos son... | Usa |
|---|---|
| Estructurados (API JSON) | Adapter + SyncService |
| No estructurados (texto libre) | Webhook + Cola IA |
| Lista de refugios/localizados | POST /api/localizados |
| Eventos de desastre | Scraper + DisasterSyncWorker |

### Paso 2: Crear adapter (si aplica)

```typescript
// back/src/adapters/mi-fuente.adapter.ts
import { ISourceAdapter } from './base.adapter';

export class MiFuenteAdapter implements ISourceAdapter<any> {
  sourceName = 'mi-fuente';

  normalize(raw: any) {
    return {
      name: raw.nombre_completo,
      source: this.sourceName,
      externalId: String(raw.id),
      status: raw.encontrado ? 'found' : 'missing',
      'lastSeen.state': raw.estado,
    };
  }
}
```

Registrar en `factory.adapter.ts`:
```typescript
import { MiFuenteAdapter } from './mi-fuente.adapter';
registerAdapter('mi-fuente', new MiFuenteAdapter());
```

### Paso 3: Validar con Zod

```typescript
// back/src/validators/mi-fuente.validator.ts
export const miFuentePayloadSchema = z.object({
  name: sanitizedString,
  externalId: safeIdString,
  status: z.enum(['missing', 'found']),
  'lastSeen.state': z.string().max(100),
});
```

### Paso 4: Sincronizar

```typescript
import { syncFromSource } from '../services/sync-source.service';

const result = await syncFromSource(items, {
  source: 'mi-fuente',
  chunkSize: 100,
  onItem: (item) => adapter.normalize(item)
});
```

### Paso 5: Programar

Agregar cron en `worker.ts` o en `server.ts`, o crear un job que se dispare desde la cola `disaster-sync`.

---

## 17. Reglas de Oro

1. **Idempotencia siempre** — Toda integración debe poder ejecutarse N veces sin duplicar datos. Usa `idHash` + `SyncState`.
2. **Respeta rate limits** — `await sleep(500)` entre páginas de APIs externas.
3. **No guardes datos ultra-sensibles** — Teléfonos personales, direcciones exactas, historiales médicos no se almacenan en `UnifiedPerson`. Solo estado, ciudad, condición general.
4. **try/catch en todo** — Si una fuente externa falla, loguea el error y detente grácilmente. Nunca rompas el worker completo.
5. **Zod valida todo** — Nunca confíes en datos externos. Valida tipo, longitud, sanitiza HTML.
6. **Carga en batches** — Usa `chunkSize: 100` en `bulkWrite` para no saturar MongoDB.
7. **Audita todo** — Las acciones de admin (merge, status change, etc.) se registran en `AuditLog`.
