# Documentación del Frontend — Reencuentro Terremoto Venezuela

> **Idioma:** Español · **Tono:** Técnico con sensibilidad humana · **Audiencia:** Desarrolladores frontend, diseñadores, colaboradores del proyecto

---

## Índice

1. [¿Qué es este frontend?](#1-qué-es-este-frontend)
2. [Estructura del paquete](#2-estructura-del-paquete)
3. [Punto de entrada: main.tsx](#3-punto-de-entrada-maintsx)
4. [App.tsx: el orquestador de vistas](#4-apptsx-el-orquestador-de-vistas)
5. [Autenticación: AuthContext y flujo de login](#5-autenticación-authcontext-y-flujo-de-login)
6. [Cliente HTTP: api.ts y CSRF automático](#6-cliente-http-apits-y-csrf-automático)
7. [Páginas y vistas](#7-páginas-y-vistas)
8. [Flujo de reporte: ReportModal de 7 pasos](#8-flujo-de-reporte-reportmodal-de-7-pasos)
9. [Componentes comunes](#9-componentes-comunes)
10. [Hooks personalizados](#10-hooks-personalizados)
11. [Socket.IO en el frontend](#11-socketio-en-el-frontend)
12. [Offline-first: Service Worker y Dexie](#12-offline-first-service-worker-y-dexie)
13. [Mapa interactivo con Leaflet](#13-mapa-interactivo-con-leaflet)
14. [Panel de administración](#14-panel-de-administración)
15. [Estilos y tema oscuro](#15-estilos-y-tema-oscuro)
16. [PWA y estrategia de caché](#16-pwa-y-estrategia-de-caché)
17. [Pruebas](#17-pruebas)

---

## 1. ¿Qué es este frontend?

Es una **SPA (Single Page Application)** construida con **React 19** y **TypeScript 6**, empaquetada con **Vite 8**. Está diseñada para ser **resiliente, accesible y funcional en condiciones adversas**: durante un desastre natural, el internet puede ser intermitente, los dispositivos pueden ser de gama baja, y los usuarios pueden estar en estado de estrés.

Este frontend no es solo una interfaz bonita. Es una **herramienta de emergencia** que debe funcionar aunque no haya conexión, consumir pocos datos, y ser intuitiva para personas que nunca han usado tecnología similar.

Está desplegada en **Vercel** con PWA habilitada (puede instalarse como app en el teléfono) y un service worker personalizado que cachea estratégicamente los datos.

---

## 2. Estructura del paquete

```
front/
├── public/                    # Archivos estáticos (favicon, manifest, etc.)
├── src/
│   ├── __tests__/             # 8 archivos de test (Vitest)
│   ├── assets/                # Imágenes (hero, logo)
│   ├── components/            # Componentes reutilizables
│   │   ├── common/            # 12 componentes de uso general
│   │   ├── map/               # Componentes del mapa Leaflet
│   │   ├── modals/            # Modales principales (Reporte, Detalle, Auth)
│   │   └── ui/                # Sistema de diseño (Button, Input)
│   ├── constants/             # Constantes (rutas, vistas)
│   ├── data/                  # Datos estáticos (biblioteca de recursos)
│   ├── db/                    # Dexie (IndexedDB) para offline
│   ├── hooks/                 # 3 hooks personalizados
│   ├── layouts/               # Layout principal (AppLayout) + navegación móvil
│   ├── lib/                   # Utilidades (sanitize con DOMPurify)
│   ├── pages/                 # 11 páginas (cada una en su directorio)
│   │   ├── Admin/             # Panel de administración (8 secciones)
│   │   ├── Auth/              # Login y registro
│   │   ├── Directory/         # Directorio de organizaciones verificadas
│   │   ├── Feed/              # Feed de personas con scroll infinito
│   │   ├── Home/              # Landing page + gateway
│   │   ├── Library/           # Biblioteca de recursos
│   │   ├── Logistics/         # Alertas logísticas
│   │   ├── Manual/            # Guías éticas y políticas
│   │   ├── Map/               # Mapa interactivo
│   │   ├── Profile/           # Perfil de usuario (3 tabs)
│   │   └── Search/            # Búsqueda normal + vectorial
│   ├── services/              # api.ts (Axios + CSRF interceptor)
│   ├── store/                 # 3 Contextos de React (Auth, Socket, Toast)
│   ├── types/                 # Interfaces compartidas (Person, Disaster)
│   ├── utils/                 # Utilidades (sync, humanizeError)
│   ├── App.tsx                # Componente raíz (ruteo por estado)
│   ├── index.css              # Estilos globales + variables CSS + tema oscuro
│   ├── main.tsx               # Entrypoint (árbol de providers)
│   ├── setupTests.ts          # Configuración de Vitest
│   └── sw.ts                  # Service Worker personalizado
├── index.html                 # HTML de entrada de Vite
├── package.json               # Dependencias y scripts
├── tsconfig.json              # References a tsconfig.app + tsconfig.node
├── tsconfig.app.json          # Config TypeScript para src/
├── tsconfig.node.json         # Config TypeScript para tools
├── vite.config.ts             # Vite + React + PWA
├── vitest.config.ts           # Vitest + jsdom
├── vercel.json                # SPA fallback + proxy /api a Render
└── .oxlintrc.json             # Configuración de Oxlint
```

### Filosofía de la estructura

- **Páginas en directorios**: cada página tiene su propio directorio con su CSS, componentes hijos, y tipos
- **Componentes compartidos en `components/`**: todo lo reutilizable vive aquí, organizado por función
- **Estado global en `store/`**: solo 3 contextos (Auth, Socket, Toast) — el resto es estado local o props
- **Sin ESLint**: usan Oxlint, que es ~50x más rápido
- **Sin Prettier**: el formateo se maneja con confianza en el equipo

---

## 3. Punto de entrada: main.tsx

**Archivo:** `front/src/main.tsx`

### Árbol de providers

```tsx
<Sentry.ErrorBoundary fallback={FALLBACK_UI}>
  <GoogleOAuthProvider clientId={VITE_GOOGLE_CLIENT_ID}>
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  </GoogleOAuthProvider>
</Sentry.ErrorBoundary>
```

### Orden y razón de cada provider

| Provider | Propósito |
|---|---|
| **Sentry.ErrorBoundary** | Captura errores de renderizado. Muestra una UI empática ("Algo salió mal, el equipo ya fue notificado") con botón de recarga |
| **GoogleOAuthProvider** | SDK de Google Login. Sin esto, no funciona el botón "Iniciar sesión con Google" |
| **AuthProvider** | Estado de sesión global. Cualquier componente puede saber si hay usuario logueado |
| **SocketProvider** | Conexión Socket.IO para notificaciones en tiempo real |
| **ToastProvider** | Notificaciones toast (mensajes emergentes temporales) |

### Sentry en el frontend

Inicializado con:
- **Browser Tracing**: mide rendimiento de navegación
- **Session Replay**: graba la sesión del usuario para depurar errores (solo 10% de sesiones, 100% cuando hay error)
- **Trace propagation**: envía tracing headers al backend para correlacionar frontend ↔ backend

### FALLBACK_UI

Si la aplicación explota completamente, Sentry muestra una pantalla de error con:
- Mensaje empático: "Ocurrió un error inesperado"
- Acción clara: botón "Recargar página"
- Diseño que respeta el tema oscuro

---

## 4. App.tsx: el orquestador de vistas

**Archivo:** `front/src/App.tsx`

### ¿Por qué ruteo por estado y no por URL?

**Decisión de diseño deliberada:** esta aplicación usa `useState<View>` en lugar de React Router para navegar entre pantallas.

¿Por qué? Porque esta app es una **herramienta**, no un sitio web. El usuario no necesita compartir URLs de páginas internas ("mira mi feed de desaparecidos"), ni el SEO importa (es una app con login). El ruteo por estado:
- Es más simple: no hay rutas anidadas, ni parámetros de URL, ni lazy loading complejo
- Es más rápido: no hay parseo de rutas, ni history API
- Es más seguro: no se exponen IDs de personas en la URL

**Excepción:** React Router 7 está instalado y se usa para enlaces dentro de la app (ej: en el perfil), pero el ruteo principal es por estado.

### Vistas disponibles

```typescript
type View = 'home' | 'feed' | 'search' | 'map' | 'report'
  | 'admin' | 'library' | 'profile' | 'logistics'
  | 'login' | 'register' | 'manual' | 'directorio';
```

### Lazy loading

Las páginas pesadas (Mapa con Leaflet, AdminDashboard) se cargan con `React.lazy()`:

```typescript
const MapPage = lazy(() => import('./pages/Map/MapPage'));
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
```

Esto significa que Leaflet (1.2MB) solo se descarga cuando el usuario hace clic en "Mapa".

### Control de acceso

```typescript
const navigate = (v: View) => {
  if (AUTH_VIEWS.includes(v) && !user) {
    setActiveView('login');  // Redirige a login si no hay sesión
    return;
  }
  setActiveView(v);
};
```

### Modales globales

App.tsx mantiene tres modales a nivel global (fuera del layout):

| Modal | ¿Cuándo se muestra? |
|---|---|
| `PersonDetailModal` | Cuando el usuario hace clic en una persona (desde feed, mapa, perfil) |
| `AuthModal` | Cuando el usuario no ha completado su perfil e intenta reportar |
| `ReportModal` | Wizard de 7 pasos para reportar una persona |

### Hook usePersons

App.tsx ya no maneja data fetching directamente. Toda la lógica de carga de personas, desastres, conteos y localizados vive en el hook `usePersons`, que expone:
- `persons`, `disasters`, `counts`: los datos
- `loading`, `loadingMore`, `hasMore`: estados de carga
- `searchQuery`, `setSearchQuery`: búsqueda con debounce de 500ms
- `loadMore`: callback para infinite scroll

---

## 5. Autenticación: AuthContext y flujo de login

**Archivo:** `front/src/store/AuthContext.tsx`

### ¿Qué guarda el contexto?

```typescript
interface AuthContextType {
  user: User | null;       // null = no hay sesión
  login: (user, token?) => void;
  logout: () => void;
  updateUser: (user) => void;
  isLoading: boolean;      // true mientras se verifica sesión al cargar
}
```

### Flujo al iniciar la aplicación

```
1. Se monta AuthProvider
2. useEffect → refreshCsrfToken()  ← siembra cookie CSRF
3. GET /auth/me                    ← ¿hay cookie de sesión?
4.    ├─ Éxito: res.data.user → setUser(user)
5.    └─ Error: user = null (sesión expirada o no existe)
6. isLoading = false → la app sabe si hay sesión
```

### Doble canal de JWT

El token JWT se persiste en dos lugares:
1. **Cookie httpOnly** (canal primario, segura contra XSS)
2. **localStorage** (canal secundario, para compatibilidad con proxy de Vercel)

El interceptor de Axios lee el JWT de localStorage y lo envía como `Authorization: Bearer` — el backend acepta Bearer O cookie.

### Login con Google OAuth

```
Usuario → "Iniciar sesión con Google"
         → Google OAuth popup
         → Google devuelve { credential }
         → POST /api/auth/google { credential }
         → Backend verifica con google-auth-library
         → Backend crea o actualiza usuario en BD
         → Backend setea cookie httpOnly + devuelve JWT
         → persistToken(jwt) + setUser(user)
```

### Control de acceso

- `user = null` → HomeGateway (landing público)
- `user.role = 'admin'` → puede ver AdminDashboard
- `user.isProfileComplete = false` → se muestra AuthModal para completar datos
- `user.status = 'pending'` → usuario solicitó ser verificador, está en revisión

---

## 6. Cliente HTTP: api.ts y CSRF automático

**Archivo:** `front/src/services/api.ts`

### Instancia compartida de Axios

```typescript
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,  // envía cookies httpOnly
});
```

Todas las llamadas HTTP pasan por esta instancia. No hay `fetch` directo en ningún componente.

### Interceptor de request: CSRF + JWT automático

Antes de cada request:
1. Si hay JWT en localStorage, lo agrega como `Authorization: Bearer`
2. Si el método es mutante (POST, PUT, PATCH, DELETE), lee el token CSRF de memoria o cookie y lo agrega como header `x-csrf-token`

**El componente nunca necesita pensar en CSRF o JWT. El interceptor lo hace automáticamente.**

### Interceptor de response: auto-recuperación

Dos estrategias de retry automático:

**1. Cold start de Render (503)**
Render free tier hiberna tras ~15 min sin tráfico. El primer request recibe 503 mientras Node.js arranca (~20-30s). El interceptor reintenta hasta 3 veces con backoff exponencial:
- 1er reintento: 3s
- 2do reintento: 6s
- 3er reintento: 12s

**2. CSRF expirado (403)**
Si el backend responde 403 por CSRF:
1. Refresca el token (`GET /auth/csrf-token`)
2. Reintenta el request original UNA vez

### Transformación de URLs de imágenes

El interceptor también transforma URLs de imágenes de minio:9000 (red interna de Docker) a URLs públicas accesibles desde el frontend.

### Persistencia del token CSRF

```typescript
let csrfToken: string | null = null;  // variable de módulo, no estado de React
```

No está en React State porque los interceptores de Axios corren fuera del ciclo de vida de React. Una variable de módulo es más simple y no causa re-renders.

---

## 7. Páginas y vistas

### 7.1 Home (HomePage / HomeGateway)

**Archivo:** `pages/Home/`

Dos versiones:
- **HomeGateway**: para usuarios no logueados. Muestra logo, estadísticas (personas reportadas, encontradas), y acciones principales: Buscar, Reportar, Directorio, Manual
- **HomePage**: para usuarios logueados. Muestra bienvenida personalizada, acceso rápido a feed, búsqueda, y reporte

### 7.2 Feed (Feed.tsx)

**Archivo:** `pages/Feed/Feed.tsx`

Scroll infinito con `IntersectionObserver`. Tamaño de página: 50. Muestra tarjetas de personas con carga perezosa de imágenes.

**Componentes:**
- `FeedCard.tsx`: tarjeta individual con nombre, estado, ubicación, foto
- `FeedSidebar.tsx`: sidebar con filtros y conteos

### 7.3 Search (SearchPage.tsx)

**Archivo:** `pages/Search/SearchPage.tsx`

Dos modos de búsqueda:
- **NormalSearchForm**: búsqueda por texto con debounce de 500ms, filtros por estado y categoría
- **AiSearchForm**: búsqueda semántica vectorial (POST /api/search/vector) — permite buscar por descripción, no solo por nombre

### 7.4 Map (MapPage.tsx)

**Archivo:** `pages/Map/MapPage.tsx`

Mapa interactivo con Leaflet. Sección dedicada más adelante.

### 7.5 Profile (ProfilePage.tsx)

**Archivo:** `pages/Profile/ProfilePage.tsx`

Tres tabs:
- **TabReports**: mis reportes (personas que he reportado)
- **TabMatches**: mis coincidencias (personas que podrían estar relacionadas con mis reportes)
- **TabChats**: mis conversaciones (mensajes enmascarados con otros usuarios)

### 7.6 Admin (AdminDashboard.tsx)

**Archivo:** `pages/Admin/AdminDashboard.tsx`

Panel completo de administración con 8 secciones. Sección dedicada más adelante.

### 7.7 Otras páginas

| Página | Archivo | Propósito |
|---|---|---|
| **Library** | `pages/Library/LibraryPage.tsx` | Biblioteca de recursos (guías, protocolos, contactos de emergencia) |
| **Logistics** | `pages/Logistics/LogisticsPage.tsx` | Alertas logísticas (refugios, centros de acopio, donaciones) |
| **Manual** | `pages/Manual/ManualPage.tsx` | Guías éticas, políticas de privacidad, términos de uso |
| **Directory** | `pages/Directory/DirectoryPage.tsx` | Directorio de organizaciones verificadas (ONGs, organismos) |
| **Auth/Login** | `pages/Auth/LoginPage.tsx` | Login con email/password + Google |
| **Auth/Register** | `pages/Auth/RegisterPage.tsx` | Registro de nuevo usuario |

---

## 8. Flujo de reporte: ReportModal de 7 pasos

**Archivo:** `front/src/components/modals/ReportModal.tsx`

Es el flujo más crítico de la aplicación. Un ciudadano reporta a una persona desaparecida o encontrada. El diseño prioriza:

- **Minimizar fricción**: el usuario puede reportar en menos de 2 minutos
- **Funcionar sin internet**: el reporte se guarda en IndexedDB si no hay conexión
- **Ser inclusivo**: soporta entrada por voz para personas con baja alfabetización digital
- **Ser preciso**: la IA ayuda a estructurar la información

### Los 7 pasos

| Paso | Componente | ¿Qué hace el usuario? |
|---|---|---|
| **1** | `StepCategory` | Selecciona categoría: persona desaparecida, persona encontrada, fallecido, mascota |
| **2** | `StepVoice` | Describe la situación con su voz (reconocimiento de voz en español) o texto |
| **3** | `StepCharacteristics` | Características físicas: edad, género, color de piel, cabello, ojos, contextura |
| **4** | `StepFeatures` | Señas particulares: cicatrices, tatuajes, lunares, vestimenta |
| **5** | `StepLocation` | Ubicación: dónde fue vista la persona por última vez (con mapa) |
| **6** | `StepSuccess` | Confirmación: resumen de todo el reporte antes de enviar |

### Paso 2: Asistente de voz

Usa `react-speech-recognition` con reconocimiento continuo en `es-VE` (español venezolano).

Al confirmar, un extractor local (`iaExtractor.ts`) analiza el texto y extrae datos estructurados usando expresiones regulares:

```typescript
// Ejemplo: "Vi a una mujer como de 30 años, piel blanca, cabello castaño"
// → { genero: 'F', edad: '30', piel: 'blanca', cabello: 'castaño' }
```

### Modo IA vs Manual

El usuario puede elegir entre:
- **Modo IA**: describe con su voz, la IA estructura los datos
- **Modo Manual**: llena los campos uno por uno

### Offline durante el reporte

Si el usuario no tiene internet:
1. El banner "El reporte lo puedes hacer incluso si no tienes señal" es visible desde el paso 1
2. Al enviar, si la petición HTTP falla, el reporte se guarda en Dexie (IndexedDB) con status `pending`
3. El `useBackgroundSync` hook intenta sincronizar cuando hay conexión
4. El `NetworkBadge` muestra cuántos reportes están pendientes de envío

---

## 9. Componentes comunes

**Directorio:** `front/src/components/common/`

### CategorySelector

Selector visual de categorías (persona desaparecida, persona encontrada, mascota, etc.). Usa emojis como íconos para ser universal (no requiere traducción).

### ChatWidget

Widget de chat en tiempo real usando Socket.IO. Permite comunicación enmascarada entre usuarios que reportaron y usuarios que encontraron. Los mensajes se almacenan en el backend a través de `CaseContact`.

### CustomSelect

Select personalizado con tema oscuro, accesible por teclado.

### EmptyState

Componente que se muestra cuando no hay datos: "No se encontraron personas" con ilustración y acción sugerida.

### LoadingScreen

Pantalla de carga completa con spinner y texto opcional. Usada con `Suspense` en lazy loading.

### ModalOverlay

Overlay genérico para modales con cierre al hacer clic fuera y atrapamiento de foco (`focus trap`).

### NameCell

Celda de nombre con indicador de urgencia (color según `urgencyScore`).

### NetworkBadge

**Archivo:** `front/src/components/common/NetworkBadge.tsx`

Indicador de estado de conexión:
- **Online**: verde, invisible la mayoría del tiempo
- **Offline**: rojo, visible
- **Sincronizando**: amarillo, con contador de reportes pendientes

### Skeleton

Componente de placeholder shimmer para estados de carga. Muestra una silueta del contenido antes de que los datos lleguen.

### StepProgressBar

Barra de progreso para el wizard de reporte. Muestra los pasos completados, el actual, y los pendientes.

### UI: Button e Input

**Directorio:** `front/src/components/ui/`

Sistema de diseño mínimo:
- **Button**: variantes (primary, secondary, ghost), tamaños, loading state, fullWidth
- **Input**: con label, error state, theme oscuro

Usan CSS Modules (`.module.css`) para encapsular estilos.

---

## 10. Hooks personalizados

**Directorio:** `front/src/hooks/`

### usePersons

**Archivo:** `front/src/hooks/usePersons.ts`

Hook principal de data fetching. Extrajo toda la lógica que originalmente estaba en App.tsx.

```typescript
function usePersons(): {
  persons, disasters, counts, total,
  loading, loadingMore, hasMore,
  searchQuery, setSearchQuery, loadMore
}
```

**Flujo interno:**
1. Al montar y al cambiar `searchQuery`, hace fetch con debounce (500ms)
2. `fetchPersons` combina 4 endpoints en paralelo (`Promise.all`):
   - `GET /persons?limit=50&offset=N` — personas
   - `GET /disasters/active` — desastres activos
   - `GET /persons/counts` — estadísticas (cacheadas en Redis)
   - `GET /localizados?...` — personas en refugios
3. Los localizados se transforman al formato Person con status `found`
4. Sin query, mezcla aleatoriamente (shuffle) los resultados para variedad visual
5. `loadMore` incrementa offset y concatena resultados (append mode)

### useNetworkStatus

**Archivo:** `front/src/hooks/useNetworkStatus.ts`

Monitorea `navigator.onLine` y eventos `online`/`offline`. Devuelve `isOnline: boolean`. Usado por `NetworkBadge` y `useBackgroundSync`.

### useBackgroundSync

**Archivo:** `front/src/hooks/useBackgroundSync.ts`

Gestiona la sincronización de reportes offline:
1. Al montar, registra el evento `sync-reports` en el Service Worker
2. Escucha mensajes del SW (`trigger-sync`)
3. Cuando hay conexión, procesa todos los reportes pendientes en Dexie
4. Envía cada reporte al backend y actualiza el status (pending → synced / failed)

---

## 11. Socket.IO en el frontend

**Archivo:** `front/src/store/SocketContext.tsx`

### Conexión

```typescript
const socketInstance = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: true,
});
```

- Se conecta solo si hay usuario logueado
- Se desconecta al hacer logout
- Usa `withCredentials: true` para enviar cookies de sesión

### Notificaciones en tiempo real

El servidor puede enviar eventos `notification` con:
- `title`: título corto (ej: "Reporte Procesado")
- `message`: descripción (ej: "El reporte para 'María Pérez' ha sido procesado")
- `type`: 'success' | 'warning' | 'info' | 'danger'

El contexto mantiene un array de notificaciones con:
- Conteo de no leídas (`unreadCount`)
- Métodos para marcar como leídas y limpiar

### ToastProvider

**Archivo:** `front/src/store/ToastContext.tsx`

Muestra notificaciones temporales (toasts) en la esquina superior derecha. Se auto-destruyen después de 5 segundos.

---

## 12. Offline-first: Service Worker y Dexie

### Service Worker personalizado

**Archivo:** `front/src/sw.ts`

No es un Service Worker genérico de PWA. Está cuidadosamente diseñado para este proyecto.

#### Estrategias de caché

| Tipo de recurso | Estrategia | ¿Por qué? |
|---|---|---|
| **API pública** (`/api/persons`, `/api/counts`, etc.) | StaleWhileRevalidate | Muestra datos cacheados inmediatamente, actualiza en background |
| **API sensible** (`/api/persons/mine`, `/api/admin`, etc.) | Network-only | Nunca cachear datos con PII |
| **Navegación** (HTML) | Cache-first con fallback offline | El shell de la app debe cargar siempre |
| **Estáticos** (CSS, JS, imágenes) | Cache-first | No cambian entre deploys |

#### Endpoints sensibles NUNCA cacheados

```typescript
const SENSITIVE_API_PATHS = [
  '/api/persons/mine',    // Mis reportes (PII)
  '/api/admin',           // Datos administrativos
  '/api/auth/me',         // Mi sesión
  '/api/contacts',        // Mis mensajes
  '/api/matches',         // Mis coincidencias
  '/api/search',          // Búsquedas (podrían contener PII)
];
```

Si no hay conexión y se intenta acceder a un endpoint sensible, el SW devuelve `{ error: 'Sin conexión' }` con status 503.

#### Sincronización en background

```typescript
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(notifyClients({ type: 'trigger-sync' }));
  }
});
```

Cuando el navegador detecta que hay conexión de nuevo, dispara el evento `sync` con tag `sync-reports`, que notifica al frontend para que procese los reportes pendientes.

### Dexie (IndexedDB)

**Archivo:** `front/src/db/offlineDb.ts`

Base de datos en el navegador para almacenar reportes cuando no hay internet.

```typescript
export interface OfflineReport {
  id?: number;
  reportData: ReportData;
  photoFile?: File;
  csrfToken?: string;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  createdAt: number;
}
```

**Migración de esquema:** la versión 2 del esquema actualiza reportes legacy (`draft_offline` → `pending`) y agrega `retryCount`.

**Índices:** `status` para consultar rápidamente cuántos reportes están pendientes, `createdAt` para ordenar.

---

## 13. Mapa interactivo con Leaflet

**Directorio:** `front/src/components/map/`

### Por qué Leaflet

Leaflet es liviano (~40KB gzipped) comparado con Google Maps (~150KB). No requiere API key. Funciona offline con tiles precargados. Es ideal para emergencias donde el internet es limitado.

### Componentes del mapa

| Componente | Archivo | Función |
|---|---|---|
| `Map.tsx` | `components/map/Map.tsx` | Mapa principal con marcadores de personas y desastres |
| `MapFilters.tsx` | `components/map/MapFilters.tsx` | Filtros por tipo de marcador (personas, desastres, refugios) |
| `MapLegend.tsx` | `components/map/MapLegend.tsx` | Leyenda de colores de marcadores |

### Lazy loading

El mapa se carga con `React.lazy()` porque Leaflet es pesado (~1.2MB sin comprimir). No se descarga hasta que el usuario hace clic en "Mapa".

### Marcadores

- **Personas desaparecidas**: marcador rojo
- **Personas encontradas**: marcador verde
- **Desastres activos**: marcador naranja con ícono según tipo
- **Refugios**: marcador azul (de Localizado)

### Cluster

Usa `react-leaflet-cluster` para agrupar marcadores cuando hay muchos en una zona. Al hacer zoom, los clusters se separan en marcadores individuales.

### Error boundary

```typescript
<Sentry.ErrorBoundary fallback={<div>El mapa no está disponible...</div>}>
  <MapPage />
</Sentry.ErrorBoundary>
```

Si Leaflet falla por cualquier razón, Sentry captura el error y muestra un mensaje amigable.

---

## 14. Panel de administración

**Archivo:** `front/src/pages/Admin/AdminDashboard.tsx`

### Layout

- **Sidebar**: navegación entre secciones con íconos de Lucide
- **Topbar**: título de la sección actual + botón de volver
- **Contenido**: área dinámica que renderiza la sección activa

### 8 secciones administrativas

| Sección | Componente | ¿Qué hace? |
|---|---|---|
| **Resumen** | `SectionResumen.tsx` | Cards con conteos: total personas, missing, found, pendientes de moderación |
| **LOPNNA** | `SectionLopnna.tsx` | Casos de protección de menores (contenido sensible, acceso restringido) |
| **Moderación** | `SectionModeracion.tsx` | Reportes manuales y pendientes de revisión (nuevos, sin procesar por IA) |
| **Matches** | `SectionMatches.tsx` | Auditoría de coincidencias: revisar, confirmar o descartar matches |
| **Registros** | `SectionRegistros.tsx` | Tabla de personas con búsqueda, filtros por estado, cambio de estado masivo |
| **Búsquedas** | `SectionBusquedas.tsx` | Solicitudes de búsqueda de familias, asignar verificadores |
| **Usuarios** | `SectionUsuarios.tsx` | Gestión de roles, solicitudes de verificación, aprobar/rechazar |
| **Auditoría** | `SectionAuditoria.tsx` | Log de auditoría (acciones de administradores) |
| **Colas** | (Bull Board embebido) | Monitoreo de colas BullMQ (jobs pendientes, fallidos, en progreso) |

### Carga de datos

Al montar, carga en paralelo:
- `GET /admin/persons?limit=200` — personas con metadatos de auditoría
- `GET /persons/counts` — estadísticas

### Protección

El dashboard solo se renderiza si el usuario tiene rol `admin`. Si un usuario no-admin intenta acceder, el `navigate` en App.tsx lo redirige a login.

---

## 15. Estilos y tema oscuro

**Archivo:** `front/src/index.css`

### CSS Custom Properties

```css
:root {
  --clr-bg: #0f0f0f;
  --clr-surface: #1a1a1a;
  --clr-surface-hover: #242424;
  --clr-border: #2e2e2e;
  --clr-text: #e5e5e5;
  --clr-text-muted: #a0a0a0;
  --clr-primary: #3b82f6;
  --clr-primary-hover: #2563eb;
  --clr-danger: #ef4444;
  --clr-success: #22c55e;
  --clr-warning: #f59e0b;
  /* ... más variables ... */
}
```

### Principios de diseño

- **Tema oscuro obligatorio**: no hay modo claro. La app está diseñada para usarse en condiciones de emergencia donde una pantalla brillante puede ser molesta o consumir más batería
- **Sin framework CSS**: CSS plano con variables. No hay Tailwind, Bootstrap, ni styled-components
- **Responsive**: funciona en móviles (la mayoría de los usuarios en Venezuela acceden desde teléfonos)
- **Modular**: cada componente tiene su propio CSS o CSS Module cuando es necesario
- **Alto contraste**: ratios de contraste WCAG AA mínimo

### Paleta de colores

- **Fondo**: grises muy oscuros (#0f0f0f, #1a1a1a)
- **Texto**: grises claros (#e5e5e5, #a0a0a0)
- **Acento**: azul (#3b82f6) para acciones principales
- **Estados**: rojo (desaparecido), verde (encontrado), amarillo (desastre)
- **Superficies**: tarjetas ligeramente más claras que el fondo

---

## 16. PWA y estrategia de caché

### vite-plugin-pwa

Configurado en `vite.config.ts` con:
- **registerType**: 'autoUpdate' — el SW se actualiza automáticamente (no molesta al usuario)
- **injectManifest**: usa el SW personalizado (`sw.ts`) en lugar de generar uno genérico
- **Manifest**: generado automáticamente (iconos, nombre, tema)

### Caché en el Service Worker

Ver sección 12 para detalles de las estrategias de caché.

### Instalación como app

La app se puede instalar en el teléfono como una app nativa (Add to Home Screen). Una vez instalada:
- Se abre sin la barra de dirección del navegador
- Funciona offline parcialmente (datos cacheados)
- Recibe notificaciones push (futuro)

---

## 17. Pruebas

### Configuración

- **Framework**: Vitest 4 con entorno jsdom
- **Setup**: `src/setupTests.ts`
- **Librerías**: `@testing-library/react` para tests de componentes

### Tests existentes (8 archivos)

| Test | Archivo | ¿Qué prueba? |
|---|---|---|
| App | `__tests__/App.test.tsx` | Renderizado básico de la app |
| AuthContext | `__tests__/AuthContext.test.tsx` | Flujo de login/logout/restauración |
| AuthModal | `__tests__/AuthModal.test.tsx` | Modal de autenticación |
| offlineDb | `__tests__/offlineDb.test.tsx` | Operaciones de IndexedDB |
| sync-utils | `__tests__/sync-utils.test.ts` | Utilidades de sincronización |
| useBackgroundSync | `__tests__/useBackgroundSync.test.ts` | Hook de sincronización |
| useNetworkStatus | `__tests__/useNetworkStatus.test.ts` | Hook de estado de red |
| vite config | `__tests__/vite.config.test.ts` | Configuración de Vite |

### Mocks

- `AuthContext` se mockea para tests de componentes
- `IntersectionObserver` se mockea (no existe en jsdom)
- Leaflet se mockea completamente (no funciona en jsdom)
- La API de Axios se mockea con `vi.mock`

### Cómo ejecutar

```bash
cd front
npm test          # una vez
npx vitest         # modo watch
```

---

## Nota final: el porqué de cada decisión

Este frontend fue diseñado pensando en una persona real en Venezuela después de un desastre:

- **Ruteo por estado**: porque nadie va a compartir la URL de "feed" en Twitter. La app es una herramienta, no un sitio web
- **Offline-first**: porque después de un terremoto, lo primero que falla es la conectividad
- **Asistente de voz**: porque no todos saben escribir bien, pero todos saben hablar
- **Tema oscuro**: porque una pantalla brillante a las 2am mientras buscas a un familiar es molesta
- **Sin framework CSS**: porque menos dependencias = menos cosas que pueden fallar
- **PWA instalable**: porque una app en la pantalla de inicio es más accesible que un bookmark
- **Lazy loading de Leaflet**: porque 1.2MB de mapa no deberían retrasar la carga de la página principal
- **Sentry con session replay**: porque si la app falla mientras alguien reporta a un ser querido, necesitamos saber exactamente qué pasó

Cada línea de este frontend existe para asegurar que, cuando alguien necesite reportar o encontrar a un ser querido, la tecnología esté de su lado, no en su contra.
