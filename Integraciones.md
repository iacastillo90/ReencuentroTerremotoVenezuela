# Guía de Integración de Fuentes — ReencuentrosVE
## `docs/INTEGRACIONES.md` · Versión 3.0 · Junio 2026

> Esta guía es para desarrolladores que quieren sumar una fuente de datos nueva.  
> Gracias al principio **Open/Closed**, añadir una fuente **no requiere modificar ningún archivo existente** — solo crear uno nuevo y registrarlo en `jobs/sync-sources.js`.

---

## Índice

1. [Antes de empezar](#1-antes-de-empezar)
2. [Estructura de carpetas relevante](#2-estructura-de-carpetas-relevante)
3. [La interfaz SourceAdapter](#3-la-interfaz-sourceadapter)
4. [Paso a paso: crear un adaptador](#4-paso-a-paso-crear-un-adaptador)
5. [Registrar la fuente en el orquestador](#5-registrar-la-fuente-en-el-orquestador)
6. [Contrato de normalize()](#6-contrato-de-normalize)
7. [Resiliencia: withBackoff y degradación elegante](#7-resiliencia-withbackoff-y-degradación-elegante)
8. [Privacidad: qué campos filtrar siempre](#8-privacidad-qué-campos-filtrar-siempre)
9. [Idempotencia y sync_state](#9-idempotencia-y-sync_state)
10. [Patrones por tipo de fuente](#10-patrones-por-tipo-de-fuente)
    - [10.1 API REST / JSON](#101-api-rest--json)
    - [10.2 Google Sheet vía sheet2api](#102-google-sheet-vía-sheet2api)
    - [10.3 Bot de WhatsApp (medios directos)](#103-bot-de-whatsapp-medios-directos)
    - [10.4 Bot de Telegram (canal público)](#104-bot-de-telegram-canal-público)
    - [10.5 CSV desde repositorio GitHub](#105-csv-desde-repositorio-github)
11. [Probar el adaptador localmente](#11-probar-el-adaptador-localmente)
12. [Checklist antes de hacer PR](#12-checklist-antes-de-hacer-pr)
13. [Fuentes ya integradas (referencia)](#13-fuentes-ya-integradas-referencia)

---

## 1. Antes de empezar

**Preguntas que debes responder antes de escribir una línea de código:**

| Pregunta | Por qué importa |
|---|---|
| ¿La fuente es pública/abierta? | Solo integramos fuentes con datos publicados con consentimiento implícito o explícito. Nada de scraping de cuentas privadas. |
| ¿Cambia frecuentemente? | Define si va en memoria (caché liviana, refresco cada N min) o en BD (datos mixtos con uploads de usuarios). |
| ¿Trae PII sensible? | Cédulas, teléfonos privados, diagnósticos médicos → filtrar en el adaptador, nunca persistir en claro. |
| ¿Tiene un ID estable por registro? | Necesario para idempotencia via `sync_state`. Si no, construir uno con `sha256(campo1 + campo2)`. |
| ¿Puede caerse? | Todas las fuentes pueden caerse. El adaptador debe degradar elegantemente. |

---

## 2. Estructura de carpetas relevante

```
reencuentrosve/
│
├── import-ayudave.js          ← fuente ya integrada (usa como referencia)
├── import-dtv.js              ← fuente ya integrada
├── import-ocr-hospitals.js    ← fuente ya integrada
├── import-whatsapp.js         ← fuente ya integrada
├── import-telegram.js         ← fuente ya integrada
│
├── import-{tu-fuente}.js      ← TÚ CREAS ESTE ARCHIVO
│
├── jobs/
│   └── sync-sources.js        ← registras tu fuente aquí (una línea)
│
├── normalize.js               ← convierte cualquier raw → formato unificado
├── util/
│   └── retry.js               ← withBackoff para redes inestables
│
└── store.js                   → getSyncState / updateSyncState
```

**Regla de ubicación:** el archivo del adaptador vive en la raíz del proyecto (al mismo nivel que `server.js`), no en una subcarpeta. Esto mantiene el mismo patrón de AyudaVE v2.0 y facilita que un dev nuevo encuentre todas las fuentes en un vistazo.

---

## 3. La interfaz SourceAdapter

Todo adaptador es un módulo CommonJS que exporta exactamente estas tres propiedades:

```js
module.exports = {
  // Identificador único de la fuente. Usado como clave en sync_state y en logs.
  // Formato: kebab-case, sin espacios, sin mayúsculas. Ej: 'venezuela-te-busca'
  id: 'mi-fuente',

  // Tipo de destino:
  //   'db'     → los registros se persisten en la tabla media_records (datos que
  //              se mezclan con uploads de usuarios o requieren búsqueda SQL).
  //   'memory' → se guardan en caché en proceso (datos de solo lectura que
  //              cambian frecuentemente; si la fuente cae, conserva última copia).
  dest: 'db', // | 'memory'

  // Frecuencia de refresco en milisegundos (usado por sync-sources.js).
  // Solo aplica si dest === 'memory'. Para 'db', el refresco es manejado por el job.
  intervalMs: 30 * 60 * 1000, // 30 min (ignorado si dest === 'db')

  // Función principal. Recibe un contexto con utilidades inyectadas.
  // Retorna un array de registros normalizados.
  // Si falla, debe lanzar el error (el orquestador lo captura y conserva el caché).
  fetchAll, // async function(ctx) → NormalizedRecord[]
};
```

### El objeto `ctx` que recibe `fetchAll`

El orquestador inyecta estas utilidades para que el adaptador no importe nada del core directamente (D de SOLID — inversión de dependencias):

```js
// ctx es inyectado por jobs/sync-sources.js — no lo construyas tú
{
  normalize,          // function(raw) → NormalizedRecord
  getSyncState,       // async function(key) → { checksum } | null
  updateSyncState,    // async function(key, checksum) → void
  withBackoff,        // async function(fn, options) → any
  computeConfidence,  // function(normalized, signals) → { score, label, reasons }
  log,                // function(level, msg, data) → void  ('info'|'warn'|'error')
}
```

---

## 4. Paso a paso: crear un adaptador

### Paso 1 — Crear `import-{tu-fuente}.js`

```js
// import-mi-fuente.js
// Fuente: mi-fuente.com — descripción breve de qué trae y con qué licencia
// Atribución requerida: "Datos: mi-fuente.com"
// Frecuencia: cada 30 min en memoria | carga inicial en BD

'use strict';

const { request } = require('undici');

// ─── Constantes ───────────────────────────────────────────────────────────────

const SOURCE_ID  = 'mi-fuente';                         // kebab-case, único
const SOURCE_URL = 'https://api.mi-fuente.com/persons'; // endpoint de la fuente

// Caché en memoria para degradación elegante (solo si dest === 'memory')
let _cache = [];

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * @param {object} ctx - Contexto inyectado por sync-sources.js
 * @returns {Promise<NormalizedRecord[]>}
 */
async function fetchAll(ctx) {
  const { normalize, getSyncState, updateSyncState, withBackoff, log } = ctx;

  log('info', `[${SOURCE_ID}] Iniciando sync`);

  // 1. Obtener datos de la fuente (con retry automático)
  const raw = await withBackoff(async () => {
    const { body, statusCode } = await request(SOURCE_URL, {
      headers: { 'User-Agent': 'ReencuentrosVE/3.0 (ayuda humanitaria)' },
    });

    if (statusCode !== 200) {
      throw new Error(`HTTP ${statusCode} desde ${SOURCE_URL}`);
    }

    return body.json();
  });

  // 2. Validar que la respuesta tiene la forma esperada
  if (!Array.isArray(raw?.items)) {
    throw new Error(`[${SOURCE_ID}] Respuesta inesperada: falta campo 'items'`);
  }

  // 3. Normalizar y filtrar PII
  const records = [];

  for (const item of raw.items) {
    // 3a. Verificar idempotencia: ¿ya procesamos esta versión?
    const syncKey  = `${SOURCE_ID}:${item.id}`;
    const checksum = computeChecksum(item);
    const prev     = await getSyncState(syncKey);

    if (prev?.checksum === checksum) continue; // Sin cambios, saltar

    // 3b. Normalizar al formato unificado
    const normalized = normalize({
      source:     SOURCE_ID,
      externalId: String(item.id),
      type:       item.tipo === 'animal' ? 'animal' : 'person',
      name:       item.nombre,
      estado:     item.estado,
      municipio:  item.municipio,
      mediaUrl:   item.foto_url || null,
      data: {
        age:         item.edad  || null,
        description: item.descripcion || '',
        condition:   item.condicion   || '',
        // ⚠️ NO incluir: cedula, telefono, direccion_exacta, diagnostico
      },
    });

    // 3c. Score de confianza inicial (señales disponibles sin IA — la IA lo refinará en el worker)
    const { score, label } = computeConfidence(normalized, {
      hasMedia:               !!normalized.mediaUrl,
      aiEmbeddingScore:       0,     // aún no procesado; el worker lo actualizará
      hasDuplicateCandidates: false,
      adminVerified:          false,
    });
    normalized.confidence_score = score;
    normalized.confidence_label = label;

    // 3d. Actualizar sync_state DESPUÉS de normalizar (no antes)
    await updateSyncState(syncKey, checksum);
    records.push(normalized);
  }

  log('info', `[${SOURCE_ID}] Sync completado: ${records.length} registros nuevos/actualizados`);

  // 4. Actualizar caché en memoria (para degradación elegante)
  if (records.length > 0) _cache = records;

  return records;
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

/**
 * Checksum determinístico de un registro crudo.
 * Cambia si cambia cualquier campo relevante del registro.
 */
function computeChecksum(item) {
  const relevant = JSON.stringify({
    nombre:      item.nombre,
    estado:      item.estado,
    condicion:   item.condicion,
    foto_url:    item.foto_url,
    updated_at:  item.updated_at,
  });
  return require('crypto').createHash('md5').update(relevant).digest('hex');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  id:         SOURCE_ID,
  dest:       'db',           // 'db' | 'memory'
  intervalMs: 30 * 60 * 1000,
  fetchAll,
  getCache:   () => _cache,  // el orquestador lo llama si fetchAll falla
};
```

---

## 5. Registrar la fuente en el orquestador

Abre `jobs/sync-sources.js` y añade **una sola línea** en el array `SOURCES`:

```js
// jobs/sync-sources.js
'use strict';

// ─── Registro de fuentes ──────────────────────────────────────────────────────
// Para añadir una fuente nueva: importar aquí y añadir al array.
// No modificar nada más en este archivo.

const SOURCES = [
  require('../import-ayudave'),
  require('../import-dtv'),
  require('../import-ocr-hospitals'),
  require('../import-whatsapp'),
  require('../import-telegram'),
  require('../import-mi-fuente'),   // ← TU LÍNEA NUEVA
];

// ─── Orquestador (no tocar) ───────────────────────────────────────────────────

const store    = require('../store');
const normalize = require('../normalize');
const { withBackoff } = require('../util/retry');
const { computeConfidence } = require('../util/confidence');

function buildCtx(log) {
  return {
    normalize,
    getSyncState:     store.getSyncState,
    updateSyncState:  store.updateSyncState,
    withBackoff,
    computeConfidence,
    log,
  };
}

async function runAll() {
  for (const source of SOURCES) {
    const log = (level, msg, data) =>
      console[level === 'error' ? 'error' : 'log'](`[sync-sources][${source.id}]`, msg, data || '');

    try {
      const records = await source.fetchAll(buildCtx(log));

      if (source.dest === 'db') {
        await store.upsertMediaBatch(records);
      }
      // Si dest === 'memory', el módulo gestiona su propio caché via getCache()

    } catch (err) {
      log('error', 'fetchAll falló — conservando caché anterior', err.message);
      // No relanzar: una fuente caída no detiene las demás
    }
  }
}

// Registrar auto-refresco para fuentes en memoria
function startAutoRefresh() {
  for (const source of SOURCES) {
    if (source.dest !== 'memory' || !source.intervalMs) continue;

    setInterval(async () => {
      const log = (l, m) => console.log(`[auto-refresh][${source.id}]`, m);
      try {
        await source.fetchAll(buildCtx(log));
      } catch (err) {
        log('error', `Refresco fallido: ${err.message}`);
      }
    }, source.intervalMs);
  }
}

module.exports = { runAll, startAutoRefresh };
```

---

## 6. Contrato de `normalize()`

`normalize.js` convierte cualquier objeto crudo al formato `NormalizedRecord`. Úsala siempre — nunca construyas el objeto final a mano en el adaptador.

### Campos que acepta `normalize(raw)`

```js
normalize({
  // ── Obligatorios ───────────────────────────────────────
  source:     'mi-fuente',         // string — tu SOURCE_ID
  type:       'person',            // 'person' | 'animal'

  // ── Recomendados ───────────────────────────────────────
  externalId: '12345',             // string | null — ID en la fuente de origen
  name:       'García Pedro',      // string | null — se normaliza a MAYÚSCULAS
  estado:     'La Guaira',         // string — se normaliza al nombre canónico
  municipio:  'Vargas',            // string | null
  mediaUrl:   'https://...',       // string | null — URL de la foto/video
  mediaType:  'image/jpeg',        // string | null — si null, se auto-detecta por URL

  // ── Datos adicionales (van al campo data JSONB) ────────
  data: {
    age:         45,               // number | null
    description: 'Hombre...',      // string
    condition:   'herido leve',    // string
    clothes:     'camisa azul',    // string
    // cualquier otro campo relevante
  },
});
```

### Lo que NO debes pasar a `normalize()`

```js
// ❌ NUNCA incluir en el objeto raw ni en data{}
{
  cedula:           '...',   // PII — filtrar en el adaptador
  telefono:         '...',   // PII — filtrar en el adaptador
  telefono_privado: '...',   // PII — filtrar en el adaptador
  direccion_exacta: '...',   // PII — filtrar en el adaptador
  diagnostico:      '...',   // PII médico — filtrar en el adaptador
  historia_clinica: '...',   // PII médico — filtrar en el adaptador
}
```

La regla es simple: si el dato permite identificar o localizar a alguien de forma que pueda ponerlo en riesgo, no va. Ver sección 8 para el manejo de búsqueda por campos sensibles.

---

## 7. Resiliencia: `withBackoff` y degradación elegante

### `withBackoff` — para todas las peticiones HTTP

```js
// util/retry.js — ya existe, solo importar
const { withBackoff } = require('./util/retry');

// Uso básico (5 intentos, backoff exponencial + jitter)
const data = await withBackoff(() => request(url));

// Con opciones personalizadas
const data = await withBackoff(() => request(url), {
  maxAttempts: 3,
  baseDelayMs: 2000,   // primer reintento a los ~2s; luego 4s, 8s...
});
```

La implementación aplica `baseDelayMs * 2^(attempt-1) + random(0..500ms)`. El jitter evita que múltiples adaptadores reintenten al mismo tiempo tras un corte de red.

### Degradación elegante — caché local

Si `fetchAll` lanza una excepción, el orquestador captura el error y la fuente **no bloquea las demás**. Para fuentes en memoria (`dest: 'memory'`), el adaptador debe mantener su `_cache` y el orquestador llama a `getCache()` para servir la última copia buena:

```js
// En tu adaptador — patrón de caché defensivo
let _cache = [];

async function fetchAll(ctx) {
  const fresh = await ctx.withBackoff(() => request(URL));
  _cache = fresh.map(ctx.normalize); // actualizar solo si la petición fue exitosa
  return _cache;
}

// Si fetchAll lanza, el orquestador llama:
function getCache() { return _cache; } // devuelve la última copia buena

module.exports = { id, dest: 'memory', fetchAll, getCache };
```

---

## 8. Privacidad: qué campos filtrar siempre

### Regla general

Publicar el **mínimo útil para el reencuentro**. Si un dato no ayuda directamente a que una familia identifique a su ser querido, no va.

| Campo | ¿Publicar? | Alternativa |
|---|---|---|
| Nombre completo | ✅ Sí | — |
| Edad aproximada | ✅ Sí | — |
| Estado / municipio | ✅ Sí | — |
| Hospital / zona donde fue visto | ✅ Sí | — |
| Descripción física general | ✅ Sí | — |
| Cédula de identidad | ❌ No | Hacerla buscable server-side sin devolverla (ver abajo) |
| Teléfono privado | ❌ No | Canal de contacto vía la plataforma |
| Dirección exacta del domicilio | ❌ No | Solo estado/municipio |
| Diagnóstico médico | ❌ No | Solo condición general: "herido", "estable" |
| Historia clínica | ❌ No | Nunca |

### Campos buscables sin exponerse (cédula)

Si la fuente trae cédula y es útil para que una familia busque a alguien:

```js
// En el adaptador: guardar hash, no valor en claro
const crypto = require('crypto');

function hashCedula(cedula) {
  // Normalizar primero: sin espacios, sin puntos, solo dígitos
  const clean = String(cedula).replace(/\D/g, '').trim();
  return crypto.createHash('sha256').update(clean).digest('hex');
}

// En normalize():
data: {
  cedula_hash: item.cedula ? hashCedula(item.cedula) : null, // solo el hash
  // cedula: item.cedula  ← NUNCA esto
}
```

El endpoint de búsqueda recibe la cédula, la hashea en el servidor y compara contra `cedula_hash` — nunca se devuelve la cédula original.

### Variable de entorno `IMPORT_CONTACT`

Si la fuente trae un teléfono de contacto **público** (ej: el WhatsApp de un centro de acopio, no de una persona privada):

```js
// Solo incluir si la variable está activa
if (process.env.IMPORT_CONTACT === 'true' && item.contacto_publico) {
  normalized.data.contacto = item.contacto_publico;
}
```

---

## 9. Idempotencia y `sync_state`

Cada adaptador es responsable de no reprocesar registros que no cambiaron. La tabla `sync_state` (ya creada en el TDD) actúa como registro de última sincronización.

### Patrón completo de idempotencia

```js
async function processItem(item, ctx) {
  const { getSyncState, updateSyncState, normalize } = ctx;

  // 1. Clave única: fuente + ID externo
  const syncKey  = `${SOURCE_ID}:${item.id}`;

  // 2. Checksum del contenido relevante (no incluir campos que cambian solos
  //    como timestamps de sistema o contadores de vistas)
  const checksum = require('crypto')
    .createHash('md5')
    .update(JSON.stringify({ nombre: item.nombre, estado: item.estado, foto: item.foto_url }))
    .digest('hex');

  // 3. Comparar con el último procesamiento
  const prev = await getSyncState(syncKey);
  if (prev?.checksum === checksum) return null; // Sin cambios

  // 4. Procesar
  const normalized = normalize({ ...item, source: SOURCE_ID });

  // 5. Actualizar sync_state SOLO si el procesamiento fue exitoso
  await updateSyncState(syncKey, checksum);

  return normalized;
}
```

> **¿Por qué `updateSyncState` va al final?** Si la llamada a la BD falla a mitad de camino, el registro queda como `pending` y se reprocesa en el siguiente ciclo. Si actualizamos el state antes, un fallo posterior deja el registro huérfano para siempre.

---

## 10. Patrones por tipo de fuente

### 10.1 API REST / JSON

El patrón base. Ver la plantilla completa en la sección 4. Puntos clave:

```js
// Manejar paginación si la fuente la tiene
let page = 1;
let allItems = [];

while (true) {
  const { body } = await ctx.withBackoff(() =>
    request(`${SOURCE_URL}?page=${page}&per_page=100`)
  );
  const { items, total_pages } = await body.json();
  allItems = allItems.concat(items);
  if (page >= total_pages) break;
  page++;
}
```

### 10.2 Google Sheet vía sheet2api

Fuente: Google Sheet publicada con sheet2api (patrón de `import-acopio.js` en AyudaVE).

```js
// import-mi-sheet.js
const SOURCE_URL = `https://sheet2api.com/v1/${process.env.SHEET2API_KEY_MIFUENTE}/Hoja1`;

async function fetchAll(ctx) {
  const { body } = await ctx.withBackoff(() =>
    request(SOURCE_URL, {
      headers: { 'User-Agent': 'ReencuentrosVE/3.0' }
    })
  );
  const rows = await body.json(); // sheet2api devuelve array directo

  // Validar que es un array (sheet2api a veces devuelve un objeto de error)
  if (!Array.isArray(rows)) {
    throw new Error(`[${SOURCE_ID}] sheet2api: respuesta inesperada`);
  }

  return rows
    .filter(r => r['Nombre'] && r['Estado']) // ignorar filas vacías del sheet
    .map(r => ctx.normalize({
      source:     SOURCE_ID,
      externalId: r['ID'] || null,
      name:       r['Nombre'],
      estado:     r['Estado'],
      municipio:  r['Municipio'] || '',
      mediaUrl:   r['Foto URL'] || null,
      data: {
        description: r['Descripción'] || '',
        condition:   r['Condición']   || '',
      },
    }));
}
```

**Nota sobre variables de entorno para keys:** cada fuente que requiera un key propio usa su propia variable. No compartir keys entre fuentes.

### 10.3 Bot de WhatsApp (medios directos)

Para recibir fotos/videos reenviados al número del bot. Requiere `WHATSAPP_BOT_TOKEN`.

```js
// import-whatsapp.js — recibe webhook, no hace polling
// El servidor expone POST /webhooks/whatsapp que llama a handleIncoming()

const { request } = require('undici');
const WA_API = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
const TOKEN  = process.env.WHATSAPP_BOT_TOKEN;

// Esta fuente no tiene fetchAll convencional:
// los mensajes llegan por webhook, no por polling.
// El adaptador expone handleIncoming() que server.js llama desde la ruta webhook.

async function handleIncoming(webhookPayload, ctx) {
  const { normalize, log } = ctx;
  const entry = webhookPayload?.entry?.[0]?.changes?.[0]?.value;
  if (!entry?.messages) return [];

  const records = [];

  for (const msg of entry.messages) {
    if (!['image', 'video'].includes(msg.type)) continue; // solo medios

    // Descargar el medio desde la API de WhatsApp
    const mediaId  = msg[msg.type].id;
    const mediaUrl = await resolveMediaUrl(mediaId);

    records.push(normalize({
      source:     'whatsapp',
      externalId: msg.id,
      type:       'person', // asumir persona; el bot puede pedir confirmación
      mediaUrl,
      mediaType:  msg.type === 'image' ? 'image/jpeg' : 'video/mp4',
      data: {
        description: msg.text?.body || '',    // texto que acompañaba al medio
        wa_from:     '[REDACTED]',            // no loguear el número del remitente
      },
    }));
  }

  return records;
}

async function resolveMediaUrl(mediaId) {
  const { body } = await request(`${WA_API}/${mediaId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const { url } = await body.json();
  return url;
}

// fetchAll vacío: esta fuente es push, no pull
async function fetchAll(ctx) {
  ctx.log('info', '[whatsapp] Fuente push — no hace polling');
  return [];
}

module.exports = {
  id:         'whatsapp',
  dest:       'db',
  fetchAll,
  handleIncoming, // exportado para que server.js lo use en el webhook
};
```

### 10.4 Bot de Telegram (canal público)

```js
// import-telegram.js — polling sobre canal público
const TG_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHANNEL = process.env.TELEGRAM_CHANNEL_ID; // ej: '@reencuentros_ve'

let _lastUpdateId = 0;

async function fetchAll(ctx) {
  const { withBackoff, normalize, log } = ctx;

  const { body } = await withBackoff(() =>
    request(`${TG_API}/getUpdates?offset=${_lastUpdateId + 1}&limit=100&timeout=5`)
  );
  const { result: updates } = await body.json();

  if (!updates?.length) return [];

  const records = [];

  for (const update of updates) {
    _lastUpdateId = Math.max(_lastUpdateId, update.update_id);

    const msg = update.channel_post || update.message;
    if (!msg || String(msg.chat?.username) !== CHANNEL.replace('@', '')) continue;

    // Solo mensajes con foto
    if (!msg.photo?.length) continue;

    // Tomar la foto de mayor resolución
    const photo   = msg.photo[msg.photo.length - 1];
    const fileUrl = await resolveFileUrl(photo.file_id, withBackoff);

    records.push(normalize({
      source:     'telegram',
      externalId: String(msg.message_id),
      type:       'person',
      mediaUrl:   fileUrl,
      mediaType:  'image/jpeg',
      data: {
        description: msg.caption || '',
      },
    }));
  }

  log('info', `[telegram] ${records.length} medios nuevos, último update: ${_lastUpdateId}`);
  return records;
}

async function resolveFileUrl(fileId, withBackoff) {
  const { body } = await withBackoff(() =>
    request(`${TG_API}/getFile?file_id=${fileId}`)
  );
  const { result } = await body.json();
  return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${result.file_path}`;
}

module.exports = {
  id:         'telegram',
  dest:       'memory',
  intervalMs: 5 * 60 * 1000, // refresco cada 5 min (canal activo durante emergencia)
  fetchAll,
  getCache:   () => [], // Telegram no guarda caché local; los records ya fueron a BD
};
```

### 10.5 CSV desde repositorio GitHub

Patrón de `import-ocr-hospitals.js` (fuente: ecrespo/OCR-data en GitHub).

```js
// import-mi-csv.js
const RAW_URL = 'https://raw.githubusercontent.com/usuario/repo/main/data/archivo.csv';

async function fetchAll(ctx) {
  const { withBackoff, normalize, log } = ctx;

  const { body } = await withBackoff(() => request(RAW_URL));
  const csvText  = await body.text();

  const rows = parseCsv(csvText); // helper local, ver abajo

  log('info', `[mi-csv] ${rows.length} filas en el CSV`);

  return rows
    .filter(r => r.nombre) // ignorar filas sin nombre
    .map(r => normalize({
      source:     'mi-csv',
      externalId: r.id || null,
      type:       'person',
      name:       r.nombre,
      estado:     r.estado,
      mediaUrl:   null, // CSV sin fotos
      data: {
        age:       r.edad || null,
        condition: r.condicion || '',
      },
    }));
}

/**
 * Parser CSV mínimo (sin dependencias externas).
 * Para CSVs complejos (comillas, saltos de línea en campos), usar papaparse.
 */
function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split('\n');
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')); // sin tildes en headers

  return lines
    .filter(l => l.trim())
    .map(l => {
      const values = l.split(',');
      return Object.fromEntries(headers.map((h, i) => [h, (values[i] || '').trim()]));
    });
}

module.exports = {
  id:         'mi-csv',
  dest:       'memory',
  intervalMs: 6 * 60 * 60 * 1000, // refresco cada 6h (CSV no cambia tan seguido)
  fetchAll,
  getCache:   () => [],
};
```

---

## 11. Probar el adaptador localmente

### Prueba unitaria manual

```bash
# 1. Clona el repo y copia el .env
cp .env.example .env
# Edita .env con las variables que necesita tu fuente

# 2. Ejecuta el adaptador directamente
node -e "
const source            = require('./import-mi-fuente');
const normalize         = require('./normalize');
const { withBackoff }   = require('./util/retry');
const { computeConfidence } = require('./util/confidence');

// Simular el ctx que inyecta sync-sources.js
const ctx = {
  normalize,
  withBackoff,
  computeConfidence,
  getSyncState:    async () => null, // simular que todo es nuevo
  updateSyncState: async () => {},
  log: (l, m) => console.log('[TEST]', l, m),
};

source.fetchAll(ctx).then(records => {
  console.log('Registros devueltos:', records.length);
  console.log('Ejemplo:', JSON.stringify(records[0], null, 2));
}).catch(err => {
  console.error('Error:', err.message);
});
"
```

### Qué verificar en la salida

```
✅ records.length > 0                       — la fuente devolvió datos
✅ records[0].source === 'mi-fuente'
✅ records[0].type ∈ ['person', 'animal']
✅ records[0].checksum existe               — normalize() lo genera
✅ records[0].confidence_score ∈ [0.0, 1.0] — computeConfidence() lo asigna
✅ records[0].confidence_label ∈ ['verified','probable','unverified']
✅ El score inicial refleja la fuente: 'upload' → ~0.45, 'hospital' → ~0.65
❌ records[0].cedula                        — NO debe aparecer
❌ records[0].telefono                      — NO debe aparecer
❌ records[0].data.cedula                   — NO debe aparecer
```

### Prueba de idempotencia

```bash
# Ejecutar dos veces seguidas; la segunda debe devolver 0 registros nuevos
# (asumiendo que la fuente no cambió entre las dos ejecuciones)
node -e "..." # primera vez → N registros
node -e "..." # segunda vez → 0 registros (todos ya procesados)
```

Para probar esto localmente sin una BD real, inicializa un `Map` como mock de `getSyncState`:

```js
const syncMap = new Map();
const ctx = {
  // ...
  getSyncState:    async (key) => syncMap.get(key) || null,
  updateSyncState: async (key, cs) => syncMap.set(key, { checksum: cs }),
};
```

---

## 12. Checklist antes de hacer PR

```
[ ] El SOURCE_ID es único, en kebab-case, no colisiona con ninguna fuente existente
[ ] fetchAll devuelve NormalizedRecord[] (nunca undefined, siempre array)
[ ] withBackoff envuelve TODAS las peticiones HTTP
[ ] getCache() exportado si dest === 'memory'
[ ] PII filtrado: sin cédula, teléfono privado, diagnóstico, dirección exacta en claro
[ ] computeChecksum() usa solo campos de contenido, no timestamps de sistema
[ ] updateSyncState() se llama DESPUÉS de procesar, no antes
[ ] computeConfidence() llamado por registro; confidence_score y confidence_label presentes en cada NormalizedRecord
[ ] El BASE_SCORE de la fuente está documentado o usa el valor por defecto (0.3)
[ ] El adaptador no importa store.js ni server.js directamente (inversión de dependencias)
[ ] Probado en local con node -e "..." (ver sección 11)
[ ] Probado idempotencia: segunda ejecución devuelve 0 registros nuevos
[ ] Variable de entorno documentada en .env.example con comentario explicativo
[ ] Una línea añadida en jobs/sync-sources.js (sección SOURCES, nada más)
[ ] Atribución de la fuente en el comentario de cabecera del archivo
[ ] node docs/shoot-nuevas.js actualizado si la fuente genera nueva pantalla en el frontend
```

---

## 13. Fuentes ya integradas (referencia)

| Módulo | Fuente | Dest | Intervalo | Qué trae |
|---|---|---|---|---|
| `import-ayudave.js` | AyudaVE v2.0 API | `db` | 30 min | Personas desaparecidas + pacientes en hospitales |
| `import-dtv.js` + `audit-dtv.js` | desaparecidosterremotovenezuela.com | `db` | En carga + refresco incremental | Personas desaparecidas/encontradas con auditoría de duplicados |
| `import-ocr-hospitals.js` | GitHub: ecrespo/OCR-data (CSV) | `memory` | 6 h | Pacientes en hospitales (OCR de listas físicas) |
| `import-whatsapp.js` | Bot WhatsApp (webhook push) | `db` | Push | Fotos/videos reenviados al número del bot |
| `import-telegram.js` | Canal Telegram público | `memory` | 5 min | Fotos con caption publicadas en el canal |

**Para cada fuente existente:** el archivo del módulo es la documentación. Léelo antes de crear el tuyo — te ahorrará tiempo entender los patrones reales ya aplicados.

---

*ReencuentrosVE — iniciativa sin fines de lucro · reencuentrosve.com*  
*Complemento de AyudaVE · ayudahumanitariavenezuela.com*  
