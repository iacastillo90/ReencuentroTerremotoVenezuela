# Documento de Diseño Técnico (TDD)
**Proyecto:** Reencuentro Terremoto Venezuela 🇻🇪
**Versión:** 1.0 (Arquitectura Final en Producción)

---

## 1. Introducción y Contexto Arquitectónico

En situaciones de desastres naturales, la información ciudadana fluye de manera rápida pero caótica. El reto técnico de **Reencuentro Terremoto Venezuela** no es solo mostrar datos, sino **ingerir, limpiar, deduplicar y normalizar** reportes de personas desaparecidas provenientes de múltiples fuentes y presentarlos en una plataforma rápida, resiliente y de bajo consumo de datos.

Este documento detalla la arquitectura implementada en la versión actual en producción, las decisiones tecnológicas tomadas y cómo el sistema garantiza alta disponibilidad y privacidad.

---

## 2. Arquitectura de Alto Nivel

El sistema opera bajo un patrón de microservicios distribuidos utilizando tecnologías *Serverless* y *PaaS* para garantizar escalabilidad sin mantenimiento manual de servidores físicos (los cuales son vulnerables en situaciones de crisis).

### Componentes Core:
1. **Frontend (Vercel):**
   - **Stack:** React, Vite, TypeScript.
   - **Estrategia:** Renderizado del lado del cliente altamente optimizado (SPA). Estilos basados en CSS Variables globales con un tema oscuro estricto (orientado a la preservación de batería móvil).
2. **Backend API (Render):**
   - **Stack:** Node.js, Express, TypeScript.
   - **Estrategia:** Restful API *stateless*. Maneja la lógica de negocio, autenticación de endpoints y sirve los datos paginados a la web.
3. **Worker Service (Render):**
   - **Stack:** Node.js, BullMQ.
   - **Estrategia:** Un proceso Node.js dedicado exclusivamente a procesar trabajos en segundo plano (Scraping, Procesamiento de IA con Anthropic/OpenAI) sin bloquear la API principal.
4. **Almacenamiento Transaccional (MongoDB Atlas):**
   - **Estrategia:** Clúster NoSQL alojado en la nube. Soporta esquemas flexibles (`UnifiedPerson`), ideal para acomodar campos variables de distintas fuentes, y soporta índices Geoespaciales (`2dsphere`) para el mapa de desastres.
5. **Caché y Message Broker (Upstash Redis):**
   - **Estrategia:** Instancia Redis en la nube utilizada con dos propósitos: (a) Cachear respuestas de la API (`/persons/counts`) y (b) Servir como backend de las colas BullMQ.
6. **Almacenamiento de Medios (Supabase S3):**
   - **Estrategia:** Bucket S3-compatible utilizado para guardar las fotografías de los reportes, desacoplando el almacenamiento de medios del servidor de aplicaciones.

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
    origen: String
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

### 4.1. Ingesta y Deduplicación (El Algoritmo de Consolidación)

Cuando el sistema obtiene datos masivos (ej. desde *VenezuelaReporta* mediante CRON jobs), se enfrenta al problema de registros duplicados o superpuestos.

**Estrategia adoptada:**
1. **Generación de Firma (`idHash`):** Para cada registro entrante se genera una firma SHA-256 combinando su fuente de origen y su identificador externo (`crypto.createHash('sha256').update(source + id)`).
2. **Bulk Upsert:** Se realizan operaciones masivas (`PersonModel.bulkWrite`) configuradas como `updateOne` con la bandera `upsert: true` apuntando al `idHash`.
3. **Resultado:** Si la persona ya existe en la base de datos, simplemente se actualizan sus metadatos (como `updatedAt`); si es nueva, se crea. Esto filtra eficientemente decenas de miles de duplicados sin sobrecargar el servidor.

### 4.2. Procesamiento con Inteligencia Artificial (Reportes Manuales)

Cuando un usuario envía un reporte manual a través de la UI:
1. El usuario escribe texto libre ("Mi tía María tiene 40 años y sufre de asma...").
2. El API recibe el texto y encola un trabajo en **BullMQ**. Retorna al usuario un `202 Accepted`.
3. El Worker recoge el trabajo y envía el texto a un modelo LLM (Anthropic Anthropic o similares).
4. El modelo extrae un JSON estructurado con (nombre, edad, enfermedades, ubicación).
5. El Worker guarda la persona estructurada en MongoDB.

---

## 5. Decisiones Técnicas y Justificaciones

| Decisión | Justificación |
|----------|---------------|
| **MongoDB (NoSQL)** | Permite esquemas anidados (nested documents) para representar las coordenadas (`lastSeen.coordinates`) y el historial de fuentes sin necesidad de joins complejos. Facilita la ingesta rápida. |
| **Vite + React (SPA)** | Los usuarios en Venezuela suelen tener conexiones intermitentes. Una SPA carga los recursos estáticos (HTML, JS, CSS) una sola vez y luego solo transfiere JSON (pequeño tamaño en KB) en las navegaciones. |
| **Redis para Conteo** | La página inicial muestra el total de personas. Ejecutar un `countDocuments` sobre 50k+ registros por cada visitante tumbaría la base de datos. Redis cachea el total por 5 minutos, reduciendo la latencia a ~5ms. |
| **Sanitización MinIO/S3** | Se implementó un algoritmo en el StorageService para limpiar el `MINIO_ENDPOINT` (removiendo prefijos `https://` accidentalmente configurados) garantizando tolerancia a fallos en la configuración de infra. |

---

## 6. Privacidad y Cumplimiento (Privacy by Design)

Manejar datos de personas vulnerables requiere protocolos estrictos:

1. **Desacoplamiento de PII (Información Personal Identificable):** Los campos como números de contacto telefónico y correos electrónicos de los reportantes **nunca** se envían al frontend. El endpoint de la API (`GET /persons`) realiza una "proyección segura" de Mongoose, excluyendo todos los campos sensibles antes de enviarlos a la red.
2. **Prevención de Scraping Malicioso:** La API implementa límites de paginación (`limit <= 200`) para mitigar descargas masivas de la base de datos, protegiendo las identidades ante terceros malintencionados.
3. **Ofuscación Geográfica:** Las coordenadas en el mapa se manejan a nivel macro (zonas o ciudades) para proteger la ubicación exacta de menores o personas vulnerables.

---
*Fin del Documento de Diseño Técnico.*