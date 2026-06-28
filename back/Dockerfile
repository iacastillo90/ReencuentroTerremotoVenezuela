# ======================================================
# ETAPA 1: CONSTRUCTOR (Builder)
# Imagen pesada solo para compilar TypeScript a JavaScript
# ======================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar solo manifiestos primero → aprovecha la caché de Docker
# Si package.json no cambia, esta capa no se reconstruye
COPY package*.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies para tsc)
RUN npm ci

# Copiar el código fuente del backend
COPY . .

# Compilar TypeScript a JavaScript (salida en ./dist)
RUN npm run build

# ======================================================
# ETAPA 2: PRODUCCIÓN (Runner ultra ligero)
# Solo el binario compilado + dependencias de runtime
# ======================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Variables de entorno de producción
ENV NODE_ENV=production

# Copiar manifiestos
COPY package*.json ./

# Instalar SOLO dependencias de producción
# Esto elimina ts-node, @types/*, typescript y otras ~200MB de devDeps
RUN npm ci --omit=dev

# Copiar el código compilado desde el Builder
COPY --from=builder /app/dist ./dist

# Usuario no-root para mayor seguridad (evita correr como root en el VPS)
RUN addgroup -g 1001 -S ayudave && \
    adduser -S ayudave -u 1001
USER ayudave

# Exponer puerto de la API
EXPOSE 4000

# Health check para que Docker Compose espere a que la API esté lista
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

# Arrancar el servidor
CMD ["node", "dist/src/server.js"]
