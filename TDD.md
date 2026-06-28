# Reencuentro Terremotos Venezuela — Plataforma de Búsqueda y Alerta de Emergencias para Venezuela
### Versión 1.0 — Arquitectura Completa: Personas Desaparecidas + Desastres + Integración de IA

> **Misión:** Centralizar la búsqueda de personas desaparecidas, los alertas de desastres naturales y la información de emergencias para Venezuela, en una sola plataforma abierta, confiable y resiliente.

---

## Índice

1. [Visión General del Proyecto](#1-visión-general-del-proyecto)
2. [Módulo Central: Hub de Personas (el corazón del sistema)](#2-módulo-central-hub-de-personas-el-corazón-del-sistema)
3. [Módulo de Desastres y Emergencias](#3-módulo-de-desastres-y-emergencias)
4. [Arquitectura del Backend](#4-arquitectura-del-backend)
5. [Modelo de Datos MongoDB](#5-modelo-de-datos-mongodb)
6. [APIs Públicas a Consumir](#6-apis-públicas-a-consumir)
7. [Fuentes y Repositorios GitHub Relevantes](#7-fuentes-y-repositorios-github-relevantes)
8. [Hoja de Ruta del MVP](#8-hoja-de-ruta-del-mvp)
9. [Instrucciones para el Agente de IA](#9-instrucciones-para-el-agente-de-ia)
10. [Consejos Técnicos de Oro](#10-consejos-técnicos-de-oro)

---

## 1. Visión General del Proyecto

AyudaVE es una plataforma de código abierto diseñada específicamente para Venezuela, con tres pilares:

| Pilar | Descripción | Prioridad |
|---|---|---|
| 🔍 **Personas Desaparecidas** | Registro, búsqueda y reconciliación de reportes de personas | **CORE — obligatorio** |
| 🗺️ **Mapa de Desastres** | Visualización en tiempo real de sismos, inundaciones, incendios | Alta |
| 📡 **Integración de APIs** | Consumo automatizado de fuentes públicas venezolanas e internacionales | Alta |

**Stack tecnológico base:**
- Backend: Node.js + TypeScript
- Base de datos: MongoDB (con índices compuestos)
- Colas: BullMQ (Redis)
- Automatización: n8n (para integrar WhatsApp, Telegram, formularios)
- Frontend: Next.js o React
- Mapas: Leaflet.js / Mapbox GL
- IA: Claude API (Anthropic) para normalización y scoring

---

## 2. Módulo Central: Hub de Personas (el corazón del sistema)

> ⚠️ **Este módulo es el núcleo de AyudaVE. Todo lo demás se construye alrededor de él.**

### 2.1 Estrategia de Deduplicación y Sincronización ("El Filtro")

El backend actúa como un **Hub de Normalización**: recibimos datos caóticos de fuentes externas y los convertimos en un modelo único y coherente antes de persistirlos.

#### A. Capa de Normalización (Adapter Pattern)

Cada fuente tiene un **adaptador** que traduce su formato al Schema Único de AyudaVE:

```
Sources                    Adapters                   Schema Único
──────────                 ────────                   ────────────
venezuela-te-busca  ──→   VTBAdapter       ──→
whatsapp-ia-agent   ──→   WhatsAppAdapter  ──→   UnifiedPerson
formulario-web      ──→   WebFormAdapter   ──→
telegram-bot        ──→   TelegramAdapter  ──→
```

**Hash de Identidad:**
```typescript
// Antes de guardar, generamos un ID_Hash compuesto
const idHash = sha256(`${normalizedName}|${lastSeenLocation}|${approximateAge}`);
// Si el hash ya existe → upsert; si no → insert
```

#### B. Capa de "State Store" (El Guardia de Seguridad)

Colección `sync_state` en MongoDB para evitar re-procesar datos ya vistos:

```typescript
interface SyncState {
  externalId: string;        // ID original de la fuente
  source: string;            // "venezuela-te-busca" | "whatsapp" | etc.
  lastProcessed: Date;       // Timestamp de último procesamiento
  checksum: string;          // Hash del payload para detectar cambios reales
}

// Lógica antes de cualquier llamada pesada a la IA:
if (data.updatedAt <= syncState.lastProcessed && data.checksum === syncState.checksum) {
  return { status: 'skipped', reason: 'no_changes' };
}
```

#### C. Capa de Reconciliación (Fuzzy Matching)

Como los nombres llegan escritos de formas distintas (`"Luis Pérez"` vs `"Luis Perez"` vs `"Luís Péréz"`):

```typescript
import { distance } from 'fastest-levenshtein';

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  return (maxLen - distance(a, b)) / maxLen;
}

// En el momento de inserción:
const similarCandidates = await findSimilarPersons(normalizedName, threshold: 0.90);

if (similarCandidates.length > 0) {
  // Enviar a cola de auditoría manual en vez de insertar directamente
  await auditQueue.add('possible-duplicate', {
    incoming: newRecord,
    candidates: similarCandidates,
    similarityScores: similarCandidates.map(c => similarity(newRecord.normalizedName, c.normalizedName))
  });
} else {
  await PersonModel.upsert({ idHash }, newRecord);
}
```

**Umbral de acción:**

| Similitud | Acción |
|---|---|
| > 95% | Merge automático (log de auditoría) |
| 85–95% | Enviar a `manual_audit` queue |
| < 85% | Insertar como registro nuevo |

---

## 3. Módulo de Desastres y Emergencias

### 3.1 Tipos de Eventos a Monitorear

```
Categoria           Fuentes                         Update Rate
─────────────────   ──────────────────────────────  ───────────
Sismos              USGS, ReNaSS, FUNVISIS           Tiempo real
Inundaciones        INAMEH, Copernicus EMS            Diario
Incendios           NASA FIRMS, CONAF (adaptado)     Cada 3 horas
Huracanes           NHC NOAA, IMN                    Cada 6 horas
Emergencias sociales Fuentes manuales, Telegram      Manual
```

### 3.2 Arquitectura del Mapa de Desastres

```typescript
interface DisasterEvent {
  _id: ObjectId;
  type: 'earthquake' | 'flood' | 'fire' | 'hurricane' | 'landslide' | 'social';
  severity: 'low' | 'medium' | 'high' | 'critical';
  coordinates: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude] — GeoJSON
  };
  radius_km?: number;          // Radio de impacto estimado
  title: string;
  description: string;
  source: string;
  externalId: string;
  occurredAt: Date;
  validUntil?: Date;           // Para alertas con ventana temporal
  affectedAreas: string[];     // Estados/municipios venezolanos afectados
  metadata: {
    magnitude?: number;        // Para sismos
    depth_km?: number;         // Para sismos
    windSpeed_kmh?: number;    // Para huracanes
    rainfallMm?: number;       // Para inundaciones
    rawData: Record<string, unknown>;
  };
}
```

### 3.3 Índice Geoespacial MongoDB

```javascript
// CRÍTICO: Crear índice 2dsphere para queries geoespaciales rápidas
db.disaster_events.createIndex({ coordinates: '2dsphere' });
db.disaster_events.createIndex({ type: 1, occurredAt: -1 });
db.disaster_events.createIndex({ severity: 1, validUntil: 1 });

// Query de ejemplo: eventos en radio de 50km de Caracas
db.disaster_events.find({
  coordinates: {
    $near: {
      $geometry: { type: 'Point', coordinates: [-66.9036, 10.4806] },
      $maxDistance: 50000 // metros
    }
  },
  validUntil: { $gte: new Date() }
});
```

### 3.4 Relación Persona–Desastre

Un diseño clave: **vincular personas desaparecidas con eventos de desastre cercanos**:

```typescript
// Al ingresar un reporte de persona desaparecida:
// 1. Buscar eventos de desastre en los últimos 7 días cerca de la última ubicación
const nearbyEvents = await findNearbyDisasters(person.lastSeen.coordinates, radiusKm: 30);

// 2. Si hay match, agregar al perfil de la persona
if (nearbyEvents.length > 0) {
  person.possiblyRelatedDisasters = nearbyEvents.map(e => e._id);
  person.metadata.urgencyScore += calculateDisasterUrgencyBonus(nearbyEvents);
}
```

---

## 4. Arquitectura del Backend

### 4.1 Diagrama de Flujo General

```
                    ┌─────────────────────────────────────┐
                    │           FUENTES EXTERNAS           │
                    │  Venezuela-te-busca | WhatsApp | Web │
                    │  USGS | INAMEH | NASA FIRMS | NOAA   │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │         CAPA DE ADAPTADORES          │
                    │   (Normalización + State Store)      │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │            BullMQ QUEUES             │
                    │  ┌─────────────┐ ┌───────────────┐  │
                    │  │  ia-process │ │  audit-review  │  │
                    │  │  sync-fetch │ │  notifications │  │
                    │  └─────────────┘ └───────────────┘  │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │          WORKERS DE IA               │
                    │  (Claude API: urgency score,         │
                    │   normalización, deduplicación)      │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │              MONGODB                 │
                    │  persons | disaster_events |         │
                    │  sync_state | audit_queue |          │
                    │  notifications                       │
                    └─────────────────────────────────────┘
```

### 4.2 Endpoints Principales de la API

```
PERSONAS
GET    /api/persons?q={query}&status={status}     Búsqueda con filtros
POST   /api/persons                               Registrar nueva persona
GET    /api/persons/:id                           Detalle de persona
PUT    /api/persons/:id/status                    Actualizar estado (found/deceased)

DESASTRES
GET    /api/disasters?lat={}&lng={}&radius={}     Eventos cercanos (GeoJSON)
GET    /api/disasters?type={}&from={}&to={}       Filtrar por tipo y fecha
GET    /api/disasters/active                      Solo eventos activos ahora

SINCRONIZACIÓN
POST   /api/sync/trigger                          Disparar sync manual de fuentes
GET    /api/sync/status                           Estado de última sincronización

ADMIN
GET    /api/admin/audit                           Lista de posibles duplicados
POST   /api/admin/audit/:id/merge                 Aprobar fusión de registros
POST   /api/admin/audit/:id/dismiss               Descartar como falso positivo
GET    /api/admin/reconcile                       Dashboard de reconciliación

WEBHOOKS
POST   /webhooks/n8n/whatsapp                     Recibir mensajes de n8n
POST   /webhooks/n8n/telegram                     Recibir mensajes de Telegram
```

---

## 5. Modelo de Datos MongoDB

### 5.1 UnifiedPerson (Schema Central)

```typescript
interface UnifiedPerson {
  _id: ObjectId;

  // Trazabilidad de fuentes
  externalIds: Array<{
    source: 'venezuela-te-busca' | 'whatsapp' | 'web-form' | 'telegram' | 'manual';
    id: string;
    addedAt: Date;
  }>;

  // Identidad
  name: string;
  normalizedName: string;           // Lowercase, sin acentos, para búsquedas
  idHash: string;                   // sha256(normalizedName + location + age)
  aliases: string[];                // Apodos, variaciones conocidas del nombre

  // Situación
  status: 'missing' | 'found' | 'deceased' | 'unknown';
  lastSeen: {
    description: string;            // "Cerca del mercado de Petare"
    state: string;                  // Estado venezolano
    municipality?: string;
    coordinates?: {
      type: 'Point';
      coordinates: [number, number];
    };
    date: Date;
  };

  // Información personal
  age?: number;
  gender?: 'M' | 'F' | 'other' | 'unknown';
  description?: string;
  photoUrl?: string;
  contactPerson?: {
    name: string;
    phone?: string;
    relationship: string;
  };

  // Relaciones con desastres
  possiblyRelatedDisasters?: ObjectId[];

  // Metadata del sistema
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    lastSync: Date;
    source: string;
    urgencyScore: number;           // 0–100, calculado por IA
    aiProcessed: boolean;
    auditStatus: 'clean' | 'pending_review' | 'merged' | 'dismissed';
  };
}
```

### 5.2 SyncState

```typescript
interface SyncState {
  _id: ObjectId;
  externalId: string;
  source: string;
  lastProcessed: Date;
  checksum: string;
  processCount: number;
  lastError?: string;
}
```

### 5.3 Índices Recomendados

```javascript
// Personas
db.persons.createIndex({ normalizedName: 1, 'lastSeen.state': 1 });
db.persons.createIndex({ idHash: 1 }, { unique: true });
db.persons.createIndex({ status: 1, 'metadata.urgencyScore': -1 });
db.persons.createIndex({ 'lastSeen.coordinates': '2dsphere' }); // Para cruce con desastres
db.persons.createIndex({ 'externalIds.source': 1, 'externalIds.id': 1 });

// SyncState
db.sync_state.createIndex({ externalId: 1, source: 1 }, { unique: true });

// DisasterEvents
db.disaster_events.createIndex({ coordinates: '2dsphere' });
db.disaster_events.createIndex({ type: 1, severity: 1, occurredAt: -1 });
```

---

## 6. APIs Públicas a Consumir

### 6.1 Sismos

| API | URL | Rate Limit | Formato |
|---|---|---|---|
| USGS Earthquake API | `https://earthquake.usgs.gov/fdsnws/event/1/query` | Libre | GeoJSON |
| FUNVISIS (scraping) | `http://www.funvisis.gob.ve` | Manual | HTML |
| EMSC (European) | `https://www.seismicportal.eu/fdsnws/event/1/` | Libre | GeoJSON |

```typescript
// Ejemplo: Consumir USGS filtrando por Venezuela
const VENEZUELA_BOX = { minlat: 0.6, maxlat: 12.2, minlon: -73.4, maxlon: -59.8 };

const response = await fetch(
  `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` +
  `&minlatitude=${VENEZUELA_BOX.minlat}&maxlatitude=${VENEZUELA_BOX.maxlat}` +
  `&minlongitude=${VENEZUELA_BOX.minlon}&maxlongitude=${VENEZUELA_BOX.maxlon}` +
  `&minmagnitude=2.5&orderby=time&limit=50`
);
```

### 6.2 Clima e Inundaciones

| API | URL | Notas |
|---|---|---|
| Open-Meteo | `https://api.open-meteo.com/v1/forecast` | Libre, sin key |
| OpenWeatherMap | `https://api.openweathermap.org/data/2.5/` | Free tier disponible |
| INAMEH Venezuela | `http://www.inameh.gob.ve` | Solo scraping |
| Copernicus EMS | `https://emergency.copernicus.eu/mapping/list-of-activations-rapid` | Activaciones oficiales |

```typescript
// Ejemplo: Pronóstico de lluvia en Caracas con Open-Meteo (sin API key)
const response = await fetch(
  'https://api.open-meteo.com/v1/forecast?latitude=10.48&longitude=-66.90' +
  '&daily=precipitation_sum,rain_sum&forecast_days=7&timezone=America%2FCaracas'
);
```

### 6.3 Incendios

| API | URL | Notas |
|---|---|---|
| NASA FIRMS | `https://firms.modaps.eosdis.nasa.gov/api/` | Requiere API key gratuita |
| Global Fire Watch | `https://fires.globalforestwatch.org/api/` | Libre |

```typescript
// NASA FIRMS — Incendios activos en Venezuela (últimas 24h)
const MAP_KEY = process.env.NASA_FIRMS_KEY;
const response = await fetch(
  `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${MAP_KEY}/VIIRS_SNPP_NRT/VEN/1`
);
```

### 6.4 Huracanes y Ciclones

| API | URL | Notas |
|---|---|---|
| NOAA NHC | `https://www.nhc.noaa.gov/gis/` | Shapefiles + JSON |
| Open-Meteo (Marine) | `https://marine-api.open-meteo.com` | Libre |

### 6.5 Desastres Globales

| API | URL | Cobertura |
|---|---|---|
| ReliefWeb API | `https://api.reliefweb.int/v1/` | Emergencias humanitarias globales |
| GDACS | `https://www.gdacs.org/xml/rss.xml` | Feed RSS de desastres globales |
| WHO PAHO | `https://www.paho.org/en/topics/emergency-preparedness` | Emergencias de salud |

```typescript
// GDACS — RSS feed de desastres globales (filtrar por Venezuela)
const feed = await fetch('https://www.gdacs.org/xml/rss.xml');
// Parsear XML y filtrar eventos con locations que incluyan Venezuela
```

---

## 7. Fuentes y Repositorios GitHub Relevantes

### 7.1 Repositorios de Datos de Venezuela

```bash
# Datos geográficos de Venezuela (límites de estados, municipios)
https://github.com/datosvenezuela/geodatos-venezuela

# Shapefile de Venezuela para mapas
https://github.com/erikriver/geojson-venezuela

# Datos abiertos del país (varios datasets)
https://github.com/datosvenezuela/datos-abiertos

# Topojson de Venezuela
https://github.com/vizzuality/FFAR/tree/master/api/data/venezuela
```

### 7.2 Librerías Útiles para el Proyecto

```bash
# Fuzzy matching en español
npm install fastest-levenshtein
npm install fuse.js                  # Búsqueda difusa con soporte de acentos

# Normalización de texto en español
npm install diacritics                # Eliminar acentos
npm install unorm                    # Normalización Unicode

# Geoespacial
npm install @turf/turf               # Cálculos geoespaciales
npm install leaflet                  # Mapas interactivos

# Procesamiento de feeds
npm install rss-parser               # Parsear feeds RSS (GDACS, INAMEH)
npm install xml2js                   # Parsear XML de APIs antiguas

# Colas y trabajos en background
npm install bullmq ioredis

# Scraping (para fuentes sin API oficial)
npm install playwright               # Scraping moderno con JS rendering
npm install cheerio                  # Parseo de HTML
```

### 7.3 Proyectos de Referencia para Aprender

```bash
# Plataforma de búsqueda de personas desaparecidas (referencia)
https://github.com/PedroMartinsUC/Missing-Persons-App

# Sistema de alertas de desastres (open source)
https://github.com/nicholasgasior/disasterify

# Integración n8n + WhatsApp (referencia de arquitectura)
https://github.com/n8n-io/n8n-docs (buscar "WhatsApp" en ejemplos)

# Dashboard de emergencias con Leaflet
https://github.com/crisis-computing/crisis-platform
```

---

## 8. Hoja de Ruta del MVP

### Fase 0 — Fundamentos (Semana 1–2)

- [ ] Configurar MongoDB Atlas con índices del schema `UnifiedPerson`
- [ ] Implementar la función de `upsert` idempotente con `idHash`
- [ ] Crear el `SyncState` store y el middleware de deduplicación
- [ ] Setup de BullMQ con Redis para colas de procesamiento
- [ ] Endpoint básico `POST /api/persons` con validación

### Fase 1 — Módulo de Personas (Semana 3–4) ← CORE

- [ ] Adaptadores para Venezuela-te-busca y formulario web
- [ ] Fuzzy matching con Levenshtein + cola `manual_audit`
- [ ] Integrar Claude API para calcular `urgencyScore`
- [ ] Endpoint de búsqueda `GET /api/persons?q=` con búsqueda por texto
- [ ] Dashboard admin básico: `/api/admin/audit` (ver y aprobar duplicados)

### Fase 2 — Integración WhatsApp/Telegram (Semana 5–6)

- [ ] Configurar n8n para recibir mensajes de WhatsApp Business API
- [ ] Worker de IA: Claude extrae datos estructurados de mensajes en lenguaje natural
- [ ] Respuesta inmediata `202 Accepted` + procesamiento en background (BullMQ)
- [ ] Bot de Telegram como canal alternativo de reporte

### Fase 3 — Módulo de Desastres (Semana 7–8)

- [ ] Sync job para USGS (sismos en Venezuela, cada 5 minutos)
- [ ] Sync job para NASA FIRMS (incendios, cada 3 horas)
- [ ] Sync job para GDACS RSS (desastres globales, cada hora)
- [ ] Índice geoespacial `2dsphere` + endpoint `GET /api/disasters`
- [ ] Lógica de cruce: vincular personas con desastres cercanos

### Fase 4 — Mapa Interactivo (Semana 9–10)

- [ ] Frontend con Leaflet.js / Mapbox GL
- [ ] Capa de personas desaparecidas (puntos en el mapa)
- [ ] Capa de eventos de desastre (círculos con radio de impacto)
- [ ] Filtros por tipo, severidad y fecha
- [ ] Modo oscuro adaptado a Venezuela (poca luz en zonas con apagones)

### Fase 5 — Pulido y Producción (Semana 11–12)

- [ ] Rate limiting y autenticación en endpoints admin
- [ ] Notificaciones (email/SMS/WhatsApp) cuando se actualiza el estado de una persona
- [ ] Sistema de reportes: "He visto a esta persona" con validación
- [ ] Documentación de la API (Swagger/OpenAPI)
- [ ] Deploy en VPS accesible desde Venezuela (considerar Cloudflare para latencia)

---

## 9. Instrucciones para el Agente de IA

> Esta sección está escrita directamente para el agente que ejecutará tareas en Antigravity.

### Contexto del Proyecto

Eres el agente encargado de construir **AyudaVE**, una plataforma de emergencias para Venezuela. El proyecto tiene dos grandes módulos:

1. **Módulo de Personas Desaparecidas** — Es el corazón. Todo debe funcionar alrededor de esto. Sin este módulo, el proyecto no tiene sentido.
2. **Módulo de Desastres** — Complemento crítico que aumenta la utilidad del sistema.

### Decisiones de Arquitectura Ya Tomadas (no cambiar)

- **Base de datos:** MongoDB (no PostgreSQL, no SQL). La razón: documentos flexibles, `2dsphere` para geolocalización.
- **Deduplicación:** `idHash` con SHA-256 + Levenshtein para fuzzy matching. No cambiar por otras estrategias sin justificación.
- **Colas:** BullMQ sobre Redis. No usar `setTimeout` ni `setInterval` para trabajos asincrónicos.
- **IA:** Claude API (`claude-sonnet-4-6`) para normalización y urgencyScore. Optimizar uso de tokens con la estrategia descrita en §10.
- **n8n:** Para orquestar integraciones externas (WhatsApp, Telegram, formularios). No reescribir esto en código propio.

### Tareas Prioritarias para el Agente

Cuando el agente reciba una tarea, debe ejecutarlas en este orden de prioridad:

```
PRIORIDAD 1: Módulo de Personas
  → Cualquier tarea relacionada con UnifiedPerson, deduplicación, sync de personas

PRIORIDAD 2: Estabilidad del sistema
  → Bugs, crashes, pérdida de datos

PRIORIDAD 3: Módulo de Desastres
  → Integración de APIs externas, mapa

PRIORIDAD 4: UX y Frontend
  → Mejoras visuales, nuevas pantallas

PRIORIDAD 5: Optimizaciones
  → Performance, reducción de tokens, caching
```

### Comandos que el Agente Puede Ejecutar

```bash
# Instalar dependencias del proyecto
npm install

# Correr el servidor en modo desarrollo
npm run dev

# Ejecutar sync manual de una fuente
npm run sync -- --source usgs
npm run sync -- --source venezuela-te-busca

# Ver estado de las colas BullMQ
npm run queues:status

# Seed de datos de prueba venezolanos
npm run seed:test-data

# Ejecutar fuzzy matching manualmente
npm run reconcile -- --dry-run
npm run reconcile -- --apply

# Tests
npm test
npm run test:integration
```

### Convenciones de Código

```typescript
// Nomenclatura de archivos
adapters/venezuela-te-busca.adapter.ts    // Adaptadores
workers/ia-processor.worker.ts            // Workers de BullMQ
queues/ia-process.queue.ts                // Definición de colas
models/unified-person.model.ts            // Modelos MongoDB
utils/fuzzy-match.util.ts                 // Utilidades

// En cada función de upsert, SIEMPRE loguear:
logger.info({ idHash, source, action: 'upsert' | 'skip' | 'audit' });

// Manejo de errores: nunca silenciar
try {
  await processRecord(data);
} catch (error) {
  logger.error({ error, data, context: 'processRecord' });
  await errorQueue.add('failed-record', { data, error: error.message });
  // NO re-throw si es no-crítico; sí re-throw si corrompe datos
}
```

---

## 10. Consejos Técnicos de Oro

### 1. Indexación Inteligente
```javascript
// Para validaciones de duplicados: casi instantáneo con millones de registros
db.persons.createIndex({ normalizedName: 1, 'lastSeen.state': 1 });

// Para el mapa de desastres: obligatorio antes de cualquier query geoespacial
db.disaster_events.createIndex({ coordinates: '2dsphere' });
```

### 2. Idempotencia Estricta
Cada función de `upsert` debe funcionar igual si se ejecuta 1 vez o 100 veces:
```typescript
// Patrón correcto de upsert idempotente
await PersonModel.findOneAndUpdate(
  { idHash: computed_hash },
  {
    $set: { ...fieldsToUpdate, 'metadata.lastSync': new Date() },
    $setOnInsert: { createdAt: new Date(), externalIds: [] },
    $addToSet: { externalIds: { source, id: externalId } }
  },
  { upsert: true, new: true }
);
```

### 3. Uso de IA con Eficiencia de Tokens
```typescript
// ❌ MALO: Enviar registro completo cada vez
const result = await claude.messages.create({
  messages: [{ role: 'user', content: JSON.stringify(fullRecord) }] // Desperdicia tokens
});

// ✅ BUENO: Verificar primero si es nuevo, luego procesar
const isNew = await checkIfNewRecord(externalId); // Solo ID y nombre
if (!isNew) return; // Ahorro de ~60% tokens

const result = await claude.messages.create({
  messages: [{ role: 'user', content: JSON.stringify({ name, location, description }) }]
  // Solo los campos mínimos necesarios
});
```

### 4. Resiliencia para Venezuela
Venezuela tiene problemas de conectividad. El sistema debe funcionar con:
- **Reintentos con backoff exponencial** en todas las llamadas a APIs externas
- **Cache local** de los últimos resultados de cada fuente (TTL: 1 hora para sismos, 6 horas para clima)
- **Modo degradado:** Si una fuente falla, el sistema continúa con las demás
- **Endpoints ligeros:** Las respuestas de la API no deben superar 50KB sin paginación

```typescript
// Retry con backoff para fuentes externas
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, { timeout: 10000 });
    } catch {
      if (i === retries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // 1s, 2s, 4s
    }
  }
}
```

### 5. Privacidad de Datos
- Nunca exponer datos de contacto (teléfonos, emails) en endpoints públicos
- Endpoint de búsqueda pública: solo nombre, último lugar visto, foto (si la hay)
- Datos de contacto: solo visibles para usuarios registrados o en el endpoint admin
- Logs: nunca loguear datos personales completos, solo IDs y hashes

---

## Contribuir al Proyecto

Este es un proyecto de código abierto orientado a ayudar a personas en Venezuela. Si quieres contribuir:

1. Revisa la [Hoja de Ruta](#8-hoja-de-ruta-del-mvp) y toma una tarea de la fase actual
2. Crea un branch: `git checkout -b feature/nombre-de-feature`
3. Asegúrate de que tu cambio sea idempotente (ver §10)
4. Escribe al menos un test de integración para el módulo afectado
5. Abre un PR describiendo qué resuelve y cómo probarlo

---

*Reencuentro Terremotos Venezuela — Hecho con ❤️ para Venezuela*
*Versión 1.0 — Actualizado: Junio 2026*