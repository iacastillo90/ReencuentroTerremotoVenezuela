# AGENTS.md — Frontend (`front/`)

## Stack

- **Framework:** React 19, TypeScript 6
- **Build:** Vite 8 (SWC plugin)
- **Routing:** react-router-dom 7 (SPA con rutas manejadas por Vercel)
- **Mapas:** Leaflet + react-leaflet 5 + react-leaflet-cluster
- **Estado:** React Context (`store/AuthContext.tsx`)
- **Estilos:** CSS plano con variables CSS globales (tema oscuro)
- **Iconos:** Lucide React
- **Auth:** Google OAuth (`@react-oauth/google`)
- **HTTP:** Axios con CSRF interceptor automático
- **PWA:** `vite-plugin-pwa` con `StaleWhileRevalidate` para API calls
- **Linter:** Oxlint (no ESLint)
- **Tests:** Vitest 4 + jsdom + @testing-library/react

## Comandos exactos

```bash
cd front

# Desarrollo (HMR en localhost:5173)
npm run dev

# Build producción (tsc -b + vite build)
npm run build

# Preview de build
npm run preview

# Tests (Vitest)
npm test

# Linter (Oxlint)
npm run lint
```

## Estructura del frontend

```
front/src/
├── __tests__/         # Tests (App, AuthContext, AuthModal, vite config)
├── assets/            # Recursos estáticos
├── components/        # UI reutilizable
│   ├── map/           # Componentes de mapa Leaflet
│   └── modals/        # Modales (PersonDetailModal, ReportModal, AuthModal)
├── data/              # Datos estáticos/ejemplo
├── layouts/           # AppLayout (estructura principal con sidebar/nav)
├── pages/             # Vistas principales
│   ├── Admin/         # Dashboard administrativo
│   ├── Feed/          # Feed de personas (infinite scroll)
│   ├── Library/       # Biblioteca/guias
│   ├── Logistics/     # Apoyo logístico
│   ├── Map/           # Mapa interactivo
│   └── Profile/       # Perfil de usuario
├── services/          # api.ts (Axios instance + CSRF interceptor)
├── store/             # AuthContext.tsx (AuthProvider + useAuth hook)
├── types/             # index.ts (interfaces Person, Disaster)
├── App.tsx            # Componente raíz (ruteo por estado, no react-router)
├── main.tsx           # Entrypoint (GoogleOAuthProvider + AuthProvider)
└── index.css          # Estilos globales (CSS variables, tema oscuro)
```

## Convenios importantes

- **Ruteo por estado, no por URL:** `App.tsx` maneja las vistas con `useState<View>` — no usa `<Routes>` de react-router-dom. Las URLs no cambian al navegar entre feed/mapa/etc.
- **Paginación:** Infinite scroll con `IntersectionObserver` (ver `FeedPage`), tamaño de página = 50.
- **Búsqueda:** Debounce de 500ms en el input de búsqueda.
- **CSRF:** El interceptor de Axios en `services/api.ts` lee la cookie `csrf-token` y la envía como header `x-csrf-token` en requests mutantes.
- **PWA:** Service worker con estrategia `StaleWhileRevalidate` para calls a `/api/`.
- **Leaflet:** Los mapas se renderizan condicionalmente — los tests los mockean por completo.
- **Tema oscuro:** Obligatorio. Usa variables CSS definidas en `index.css`.

## Tests

```bash
# Todos los tests
npm test

# Modo watch
npx vitest
```

- Usa **Vitest** con entorno `jsdom`
- Mock de `AuthContext`, `api`, `IntersectionObserver`, y `react-leaflet` en los tests
- Setup en `src/setupTests.ts`
- Los tests excluyen componentes de mapa real (Leaflet no funciona en JSDOM)

## TypeScript config

- `tsconfig.app.json` para `src/` — target `es2023`, JSX `react-jsx`, moduleResolution `bundler`
- `verbatimModuleSyntax: true` — requires `type` prefix on type-only imports
- `erasableSyntaxOnly: true` — no enums, no namespaces
- Los tests están excluidos del type-checking de compilación (`"exclude": ["src/__tests__"]`)
- `tsconfig.node.json` para config files (vite.config.ts)

## Linter

```bash
npm run lint   # Oxlint — no ESLint, no Prettier
```

Config en `.oxlintrc.json`: plugins `react` + `typescript` + `oxc`, rules `rules-of-hooks: error`, `only-export-components: warn`.

## Variables de entorno (frontend)

```
VITE_API_URL=http://localhost:4000/api
VITE_GOOGLE_CLIENT_ID=...
```

Se cargan con `import.meta.env.VITE_*`. El `.env` root **no** existe en el repo.

## Despliegue

- **Vercel** con SPA fallback (`vercel.json` redirige todas las rutas a `index.html`)
- Build command: `npm run build` → output en `dist/`
- PWA `registerType: 'autoUpdate'` — el service worker se actualiza automáticamente

## Gotchas

- **React 19** — el compilador React no está activado (según README). No asumas que `useMemo`/`useCallback` son automáticos.
- **Oxlint** es el linter, no ESLint — los comandos y config son diferentes.
- **TypeScript 6** — `erasableSyntaxOnly` es estricto: no uses `enum`, `namespace`, o `constructor parameter properties`.
- **Vite 8** puede tener cambios en la API de plugins respecto a v6.
- **React Router 7** está instalado pero no se usa para ruteo principal (solo enlaces internos). No agregues `<Routes>` sin entender el pattern actual.
- Los archivos en `src/__tests__/` no están incluidos en el type-checking de `tsc -b`.
