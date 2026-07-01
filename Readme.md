# Reencuentro Terremoto Venezuela 🇻🇪

> **Misión:** Proporcionar una plataforma tecnológica robusta, segura y abierta para centralizar la búsqueda de personas desaparecidas, las alertas de emergencia y el reencuentro de familias venezolanas tras desastres naturales.

**Reencuentro Terremoto Venezuela** es una iniciativa de **código abierto**. El sistema ingesta, limpia, deduplica y centraliza cientos de miles de reportes de múltiples fuentes para ofrecer una **única fuente de verdad**, con asistencia de inteligencia artificial y **privacidad por diseño**, manteniendo siempre a una persona en el bucle de decisión para los reencuentros.

> 📖 **Documentación completa:** abre [`Doc/index.html`](Doc/index.html) (arquitectura, modelo de datos, seguridad, UX/UI).
>
> 🔓 **Este repositorio es público.** **Nunca** se versionan secretos, claves ni datos personales (PII). El archivo `.env` está en `.gitignore`; solo se versiona `back/.env.example` con los **nombres** de las variables.

---

## 🧩 ¿Qué hace?

- **Centraliza** reportes de personas (y mascotas) desaparecidas/encontradas desde varias fuentes.
- **Deduplica** automáticamente con una huella criptográfica (`idHash`).
- **Estructura** texto libre con IA (un reporte caótico → datos limpios).
- **Empareja** búsquedas con registros (con confirmación humana, nunca auto-notifica).
- **Protege** la privacidad: datos de contacto fuera de las APIs públicas y **protección especial de menores (LOPNNA)**.

---

## 🏗️ Arquitectura

Arquitectura de **microservicios sobre la nube (PaaS/Serverless)**, diseñada para resistir picos de tráfico.

### 1. Frontend (`front/`)
- **Stack:** React 19 · Vite · TypeScript · PWA · Leaflet (mapas) · Axios · Lucide.
- **Diseño:** *mobile-first* en **tema oscuro humanitario** siguiendo la marca oficial *Reencuentros Venezuela — «Juntos te encontramos»* (tipografía **Inter**; paleta azul `#0D47A1` / rojo `#E52520` / amarillo `#FFC107`). Pensado para conectividad intermitente (SPA + payloads JSON pequeños).
- **Navegación:** cabecera con indicador *Canal SOS*, barra inferior de 5 accesos (Inicio · Buscar · Reportar · Mapa · Más) y barra lateral en escritorio.
- **Vistas:** landing público, Inicio, Buscar (con categorías de edad y protección de menores), Mapa, **Directorio de organizaciones verificadas**, **Manual y políticas** (actuación sísmica + seguridad humanitaria), Biblioteca, Logística, Administración, Perfil, Login y Registro.
- **Confianza y privacidad en la UI:** tarjetas con sello *verificado* e **identidad protegida con desenfoque** para menores/casos protegidos.
- **Autenticación:** Google OAuth **y** correo/contraseña; control de acceso por roles (`user` / `verifier` / `admin`).

### 2. Backend (`back/`)
- **Stack:** Node.js · Express 5 · TypeScript · Mongoose · BullMQ + Redis · Zod.
- **Procesamiento asíncrono:** trabajos pesados (IA, scraping, sincronización) en *workers* BullMQ para no bloquear la API.
- **IA:** fábrica de proveedores intercambiables (Anthropic, OpenAI, Gemini).
- **Almacenamiento:** S3-compatible (MinIO en local / Supabase Storage en producción).

### 3. Base de datos y deduplicación (MongoDB)
El núcleo es la colección **`UnifiedPerson`**. Como en emergencias una persona se reporta múltiples veces:
- Se genera un **`idHash` (SHA-256)** único por persona a partir de su fuente e identificador.
- Las fuentes se sincronizan con `upsert`: si la persona ya existe, se **actualiza** en vez de duplicar.
- Resultado: información limpia (p. ej. ~53.000 registros sucios → ~42.000 personas únicas).
- Índices geoespaciales (`2dsphere`) para consultas por proximidad.

### 4. Ingesta automática
**Cron jobs** consumen fuentes oficiales y ciudadanas (USGS, GDACS, FIRMS, VenezuelaReporta, etc.) y canales de mensajería vía **n8n** (WhatsApp/Telegram). Normalizan estados (p. ej. `buscando` → `missing`) y aplican el patrón idempotente *fetch → transform → idHash → upsert*.

---

## 🛠️ Desarrollo local

> ⚠️ **Docker es manual:** ejecuta tú los comandos `docker ...` en tu terminal.
>
> **Recomendado:** infraestructura en Docker + back/front en local (así `NODE_ENV` no es `production` y el login de desarrollo funciona).

1. **Clona el repositorio**
   ```bash
   git clone https://github.com/iacastillo90/ReencuentroTerremotoVenezuela.git
   ```

2. **Crea tu `.env`** del backend a partir del ejemplo y complétalo (ver más abajo):
   ```bash
   cp back/.env.example back/.env
   ```

3. **Levanta la infraestructura** (MongoDB, Redis, MinIO):
   ```bash
   docker compose up -d mongodb redis minio
   ```

4. **Backend** → http://localhost:4000
   ```bash
   cd back && npm install && npm run dev
   ```

5. **Frontend** → http://localhost:5173
   ```bash
   cd front && npm install && npm run dev    # el front usa pnpm-lock; también puedes: pnpm install && pnpm dev
   ```

La forma más rápida de probar es **crear una cuenta con correo/contraseña** desde la pantalla de Registro (no requiere Google).

---

## 🔑 Variables de entorno (backend)

Configúralas en `back/.env` (basado en `back/.env.example`). **Usa tus propios valores y nunca los subas al repositorio.**

| Variable | Descripción |
|---|---|
| `MONGO_URI` | Conexión a MongoDB. |
| `REDIS_URL` | Conexión a Redis (colas/caché). |
| `MINIO_ENDPOINT` · `MINIO_PORT` · `MINIO_USE_SSL` · `MINIO_ACCESS_KEY` · `MINIO_SECRET_KEY` · `MINIO_BUCKET` · `PUBLIC_STORAGE_URL` | Almacenamiento S3-compatible. |
| `AI_PROVIDER` (+ clave del proveedor: `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY`; para Anthropic define además `ANTHROPIC_MODEL`) | Motor de IA (el modelo concreto se define por entorno, no se versiona). |
| `JWT_SECRET` | Secreto para firmar tokens. **Obligatorio en producción** (el servidor aborta si falta). Genera uno con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |
| `ADMIN_API_KEY` · `PARTNER_API_KEY` | Claves de endpoints protegidos. |
| `CORS_ORIGINS` | Lista separada por comas de los orígenes permitidos por CORS. Coincidencia **exacta** (esquema incluido): lista cada origen de producción explícitamente, p. ej. `https://app.midominio.com,https://www.midominio.com`. |
| `WEBHOOK_API_KEY` | Secreto compartido para validar los webhooks de n8n (header `x-webhook-api-key`). Sin él, el backend rechaza todos los webhooks. |
| `ALLOW_DEV_LOGIN` *(solo dev)* | Habilita el login de desarrollo sin Google (no en producción). |
| `ALLOW_MOCK_DATA` *(solo dev)* | Permite datos de ejemplo (marcados `isSimulated`) cuando una fuente no responde. |

---

## 🚀 Despliegue (producción)

| Componente | Servicio |
|---|---|
| Frontend (SPA) | **Vercel** (CDN, deploy automático desde GitHub) |
| API + Worker | **Render** (Web Service + Background Worker) |
| Base de datos | **MongoDB Atlas** |
| Caché y colas | **Upstash Redis** |
| Medios | **Supabase Storage** |

Las variables de entorno se configuran en el panel de cada servicio (**nunca** en el código).

---

## 🛡️ Privacidad y seguridad

Diseñado bajo **Privacy by Design**:

- **No se exponen datos de contacto directo** (teléfonos, direcciones exactas) en las APIs públicas; la PII se proyecta fuera en el servidor.
- **Protección de menores (LOPNNA):** los casos de niños/adolescentes se enmascaran en público y solo organizaciones verificadas acceden a sus datos.
- **Ubicación pública aproximada** (nivel de zona, no dirección exacta); cédula almacenada como **hash**.
- **Contraseñas** con `scrypt`; **JWT** obligatorio en producción; **CORS** restringido por dominio; **rate-limit**, **Helmet** y validación con **Zod**.
- **Webhooks** y **subida de medios** autenticados.

> 🔎 La plataforma pasó por una auditoría externa de divulgación responsable (Build4Venezuela). El estado de remediación se documenta en `Doc/index.html` (§12). Por ser un repositorio público, **cualquier dato sensible se trata como expuesto** y se mantiene fuera del control de versiones.

---

*Reencuentro Terremoto Venezuela — Hecho con profundo compromiso técnico y humano.* 🇻🇪
