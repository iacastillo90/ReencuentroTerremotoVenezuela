# Reencuentro Terremoto Venezuela 🇻🇪

> **Misión:** Proporcionar una plataforma tecnológica robusta, segura y abierta para centralizar la búsqueda de personas desaparecidas, alertas de emergencias y facilitar el reencuentro de familias venezolanas tras desastres naturales.

Frente a la adversidad, la tecnología debe ser un puente hacia la esperanza. **Reencuentro Terremoto Venezuela** es una iniciativa de código abierto que nace para dar respuesta a la fragmentación de información en momentos críticos. Nuestro sistema ingesta, limpia, deduplica y centraliza cientos de miles de reportes de múltiples fuentes para ofrecer una única fuente de verdad, protegiendo en todo momento la privacidad de los afectados.

---

## 🏗️ Arquitectura del Sistema

La plataforma está construida bajo una arquitectura de microservicios moderna, desplegada en la nube y diseñada para resistir picos extremos de tráfico, garantizando que nunca se caiga cuando la gente más la necesita.

### 1. Frontend (Aplicación Web)
- **Tecnologías:** React, Vite, TypeScript.
- **Diseño:** Enfoque *Mobile-first* con un tema oscuro tipo "Instagram" para ahorrar batería en dispositivos móviles (vital durante cortes de energía eléctrica) y ofrecer un alto contraste.
- **Vistas Principales:**
  - **Feed de Reencuentro:** Lista infinita y aleatoria de personas reportadas con filtros rápidos (desaparecidos, encontrados).
  - **Mapa Interactivo:** Geolocalización de última vez vistos usando Leaflet.
  - **Reporte con IA:** Formulario donde los familiares pueden escribir libremente; nuestra Inteligencia Artificial se encarga de extraer los datos estructurados.
  - **Dashboard Administrativo:** Panel de control de reconciliación y estadísticas en tiempo real.

### 2. Backend (API y Procesamiento)
- **Tecnologías:** Node.js, Express, TypeScript.
- **Procesamiento Asíncrono:** Uso intensivo de **BullMQ** y **Redis (Upstash)** para encolar trabajos pesados (IA, envío de notificaciones, scraping) sin bloquear el servidor principal.
- **Almacenamiento de Archivos:** Integración S3-compatible (Supabase Storage / MinIO) para alojar fotografías de manera segura y escalable.

### 3. Base de Datos y Deduplicación (MongoDB Atlas)
El corazón de la plataforma es nuestra colección `UnifiedPerson`. Debido a que en emergencias las personas suelen ser reportadas múltiples veces en distintas páginas, implementamos un algoritmo estricto de deduplicación:
- Se genera un **`idHash` criptográfico** único por persona usando su fuente y sus datos.
- Las bases de datos externas se sincronizan mediante operaciones `upsert`. Si una persona ya existe, se actualiza su registro en lugar de duplicarlo.
- De esta manera, garantizamos información limpia. (Ej: 53,000 registros sucios de una fuente se consolidan automáticamente en 42,000 personas únicas).

### 4. Automatización y Scraping
El sistema cuenta con **Cron Jobs** integrados que se ejecutan cada 10 minutos (o según corresponda) para consumir fuentes externas oficiales y ciudadanas (como *VenezuelaReporta*). Estos procesos extraen información, normalizan los estados (e.g. `buscando` -> `missing`) y los inyectan en nuestra base de datos.

---

## 🚀 Despliegue en Producción

El proyecto está diseñado para funcionar en un entorno *Serverless / PaaS* completamente gratuito y escalable:

- **Frontend:** Alojado en [Vercel](https://vercel.com).
- **Backend:** Alojado como Web Service en [Render](https://render.com).
- **Base de Datos:** MongoDB Atlas (Cluster 0).
- **Caché y Colas:** Upstash Redis.
- **Imágenes:** Supabase Storage.

### Variables de Entorno Requeridas (Backend)

Para desplegar tu propia instancia, necesitarás configurar las siguientes variables:

```env
# Conexión a Base de Datos y Caché
MONGO_URI=mongodb+srv://<usuario>:<password>@cluster.mongodb.net/reencuentro?retryWrites=true&w=majority
REDIS_URL=redis://default:<password>@<upstash-url>

# Configuración de Almacenamiento (Supabase S3)
MINIO_ENDPOINT=tu-proyecto.supabase.co
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=tu_access_key
MINIO_SECRET_KEY=tu_secret_key
MINIO_BUCKET=reencuentro-media
PUBLIC_STORAGE_URL=https://tu-proyecto.supabase.co/storage/v1/object/public/reencuentro-media

# IA e Integraciones
AI_PROVIDER=anthropic # o openai, gemini
ANTHROPIC_API_KEY=sk-ant-...

# Seguridad
ADMIN_API_KEY=tu_clave_secreta_para_dashboard
```

---

## 🛠️ Desarrollo Local

Si deseas contribuir al código y correr el proyecto en tu máquina:

1. **Clona el repositorio:**
   ```bash
   git clone https://github.com/iacastillo90/ReencuentroTerremotoVenezuela.git
   ```

2. **Levanta la infraestructura local (Mongo, Redis, MinIO):**
   ```bash
   docker compose up -d
   ```

3. **Inicia el Backend:**
   ```bash
   cd back
   npm install
   npm run dev
   ```

4. **Inicia el Frontend:**
   ```bash
   cd front
   npm install
   npm run dev
   ```

---

## 🛡️ Privacidad y Seguridad

Entendemos la sensibilidad de los datos que manejamos. La plataforma está diseñada bajo el principio de *Privacy by Design*:
- **No se exponen datos de contacto directo** (teléfonos o direcciones exactas de familiares) en las APIs públicas.
- Las consultas al backend omiten (proyectan fuera) cualquier información de identificación personal (PII) innecesaria.
- Los reportes manuales son filtrados y analizados para asegurar que no se difunda información que comprometa la integridad física de las personas.

---

*Reencuentro Terremoto Venezuela — Hecho con profundo compromiso técnico y humano.* 🇻🇪