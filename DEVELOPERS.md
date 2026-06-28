# Guía Técnica para Desarrolladores (Developer Hub)
**Proyecto:** Reencuentro Terremoto Venezuela 🇻🇪

Este documento es una referencia rápida (Cheat Sheet) diseñada para ingenieros, desarrolladores frontend, backend y devops que se integran al proyecto. Aquí encontrarás cómo está estructurado el repositorio, las entidades clave de la base de datos y los endpoints principales.

---

## 🏗️ Estructura del Repositorio (Monorepo)

El proyecto está organizado en un monorepo lógico con dos paquetes principales fuertemente separados, permitiendo despliegues independientes en infraestructuras Serverless/PaaS distintas.

```text
ReencuentroTerremotoVenezuela/
├── front/                 # Aplicación Web (SPA) orientada al usuario final
│   ├── src/
│   │   ├── components/    # Componentes UI reutilizables (Tarjetas, Modales)
│   │   ├── layouts/       # Estructuras de página maestras (AppLayout)
│   │   ├── pages/         # Vistas principales (Feed, Mapa, Dashboard Admin)
│   │   ├── services/      # Cliente HTTP Axios configurado (api.ts)
│   │   └── types/         # Interfaces TypeScript globales
│   └── package.json
│
├── back/                  # Servicio RESTful API y Procesos Asíncronos
│   ├── scripts/           # Scripts manuales de mantenimiento y despliegue
│   ├── src/
│   │   ├── config/        # Conexiones (MongoDB, Redis, MinIO/S3, IA)
│   │   ├── jobs/          # Tareas cron programadas (Scrapers de fuentes)
│   │   ├── models/        # Esquemas de Mongoose (Entidades DB)
│   │   ├── queues/        # Definición de colas de BullMQ (Redis)
│   │   ├── routes/        # Controladores de Endpoints Express
│   │   ├── services/      # Lógica de negocio core (IA, Storage, Sync)
│   │   ├── validators/    # Esquemas Zod para validación de Payloads
│   │   └── workers/       # Consumidores asíncronos de BullMQ (Background)
│   └── package.json
│
├── docker-compose.yml     # Orquestación de infraestructura local para desarrollo
└── *.md                   # Documentación principal (Readme, TDD, Integraciones)
```

---

## 🛠️ Stack Tecnológico Completo

**Frontend:**
- **Core:** React 18, TypeScript, Vite
- **Estilos:** CSS Variables (Vanilla), Tema Oscuro nativo (Mobile First)
- **Geolocalización:** Leaflet, React-Leaflet
- **Iconografía:** Lucide React
- **Despliegue Recomendado:** Vercel

**Backend:**
- **Core:** Node.js 22, Express.js, TypeScript
- **Base de Datos:** MongoDB (Mongoose ODM)
- **Caché y Mensajería:** Redis (ioredis), BullMQ
- **Validación:** Zod
- **IA e Integraciones:** Anthropic SDK / OpenAI SDK
- **Almacenamiento de Archivos:** Cliente MinIO (Compatible con Supabase Storage / S3)
- **Despliegue Recomendado:** Render / AWS ECS

---

## ☁️ Infraestructura y Despliegue Actual (Producción)

Actualmente, la plataforma opera bajo un modelo de servicios en la nube descentralizados (PaaS / Serverless), garantizando un despliegue tolerante a fallos sin necesidad de gestionar servidores propios:

1. **Frontend (Vercel):** La aplicación React se despliega automáticamente desde GitHub a **Vercel** (`reencuentroterremotovenezuela.vercel.app`), aprovechando su CDN global para distribuir la carga inicial al usuario casi instantáneamente.
2. **Backend API (Render):** El servidor Node.js/Express está montado como un *Web Service* en **Render**. Escucha las peticiones de la aplicación web y gestiona la seguridad y rutas.
3. **Backend Worker (Render):** Se usa un *Background Worker* separado (también en Render) que arranca el entorno, pero se dedica exclusivamente a limpiar las colas de BullMQ (como procesar las peticiones a la IA) y correr los `node-cron` para los scrapers. Esto asegura que tareas pesadas no bloqueen el API principal.
4. **Base de Datos (MongoDB Atlas):** Se utiliza **MongoDB Atlas** en la nube, exponiendo la cadena `mongodb+srv://`. Ofrece failover automático y copias de seguridad continuas.
5. **Caché y Colas (Upstash):** Las colas de trabajos y la caché en memoria son manejadas por una instancia *Serverless* de **Upstash Redis**. Proporciona tiempos de respuesta de milisegundos para contadores y ruteo de BullMQ con soporte TLS automático.
6. **Almacenamiento (Supabase Storage):** Toda imagen cargada se guarda en un bucket de **Supabase** usando su capa de compatibilidad S3 (`MinIO client` en el backend), liberando así el disco efímero de Render.

---

## 🧩 Entidades de Base de Datos (Modelos)

Nuestra base de datos NoSQL aloja entidades diseñadas con un propósito específico para resolver el caos de la información durante desastres.

### 1. `UnifiedPerson` (Persona Unificada)
- **Propósito:** Es el pilar del sistema. Unifica miles de reportes de personas desaparecidas o encontradas provenientes de WhatsApp, Formularios, y Scrapers en un solo esquema de datos limpio.
- **Por qué se creó:** Para evitar que una misma persona aparezca 5 veces en la base de datos si su familia la reportó en 5 páginas web diferentes. Utiliza un `idHash` criptográfico para consolidar reportes.
- **Campos Clave:** `name`, `status` (missing/found), `lastSeen` (GeoJSON con ciudad/estado), `photoUrl`, `metadata.urgencyScore`.

### 2. `Disaster` (Evento de Desastre)
- **Propósito:** Representar geográficamente zonas de peligro o incidentes críticos (Derrumbes, Inundaciones, Sismos).
- **Por qué se creó:** Para poder cruzar en un mapa dónde ocurrió un deslave y qué personas están reportadas como desaparecidas en ese mismo radio geográfico de impacto.
- **Campos Clave:** `title`, `type` (earthquake, flood, etc), `severity`, `coordinates` (GeoJSON Point), `radius_km`.

---

## 🔌 API Endpoints Principales

La API RESTful responde bajo el prefijo `/api` y utiliza HTTP status codes estándar.

### 🫂 Personas (`/api/persons`)

| Método | Endpoint | Descripción | Acceso |
|--------|----------|-------------|---------|
| `GET` | `/` | Retorna lista paginada de personas. Soporta búsqueda difusa (`?q=nombre`) y filtros (`?status=missing`). **Paginado (limit/offset)**. | Público |
| `GET` | `/counts` | Retorna estadísticas rápidas (totales de desaparecidos/encontrados). **Cacheado intensivamente en Redis** (TTL 5 min). | Público |
| `POST` | `/` | Envía un reporte estructurado de una persona. El sistema verifica si es duplicado antes de procesarlo. | Público |
| `PATCH`| `/:id/status`| (Solo Admin) Actualiza el estado de un reporte (ej. "Encontrado"). | Protegido |

### 🌪️ Desastres (`/api/disasters`)

| Método | Endpoint | Descripción | Acceso |
|--------|----------|-------------|---------|
| `GET` | `/active` | Retorna todos los eventos de desastre activos o recientes. | Público |

### 🤖 Inteligencia Artificial (`/api/report/ai`)

| Método | Endpoint | Descripción | Acceso |
|--------|----------|-------------|---------|
| `POST` | `/` | Recibe un **texto libre y desestructurado**. Inmediatamente responde `202 Accepted` y encola el texto en BullMQ para que el Agente IA extraiga atributos y lo consolide en un `UnifiedPerson` en background. | Público |

### 🔐 Administración (`/api/admin`)

*Nota: Todos los endpoints bajo `/admin` requieren el header `x-api-key`.*

| Método | Endpoint | Descripción | Acceso |
|--------|----------|-------------|---------|
| `GET` | `/audit` | Retorna registros de `UnifiedPerson` que el sistema marcó como "posibles duplicados" para revisión humana manual. | Protegido |
| `POST` | `/sync` | Dispara manualmente la ejecución de los Scrapers (ej: VenezuelaReporta) para ingestar datos bajo demanda. | Protegido |

---

## 🚀 Guía de Arranque Rápido para Desarrolladores

Si te acaban de asignar un ticket o *feature*, sigue estos pasos:

1. **Variables de Entorno:** Pide al administrador el archivo `.env` o créalo basado en el `.env.example`. Si usas los contenedores locales (Docker), las variables por defecto ya funcionan.
2. **Lógica de Negocio:**
   - Si debes cambiar cómo la IA extrae datos, ve a `back/src/workers/ia-processor.worker.ts`.
   - Si debes modificar el UI de las tarjetas del Feed, ve a `front/src/pages/Feed/components/FeedCard.tsx`.
3. **Migraciones:** Mongoose crea esquemas automáticamente, pero si agregas campos geoespaciales nuevos, recuerda actualizar los índices en `back/scripts/seed.ts`.

¡Feliz desarrollo! Todo el código que escribas aquí ayudará directamente a salvar vidas y conectar familias.
