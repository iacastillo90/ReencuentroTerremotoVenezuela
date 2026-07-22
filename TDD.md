# Test-Driven Development — Reencuentro Terremoto Venezuela

Estrategia, cobertura, buenas prácticas y comandos de testing para el proyecto. Este documento describe cómo y qué testeamos, la filosofía TDD que seguimos, y cómo contribuir nuevos tests.

---

## Filosofía

Este proyecto aplica **TDD moderado**:

- Los tests no se escriben antes que el código en todos los casos, pero sí se escriben **junto con el código** antes de considerar una tarea completa.
- El backend prioriza **tests de integración sobre unitarios**: cada endpoint se prueba contra MongoDB real en memoria, validando que la request, validación, lógica de negocio y respuesta funcionen como un todo.
- El frontend prioriza **tests de componentes y hooks** con mocks controlados.
- No se toleran tests que fallen en `main`. El CI bloquea merges si algún test falla.

**Principio rector:** Si un bug llegó a producción, falta un test que lo cubra. Ese test se escribe antes de aplicar el fix.

---

## Stack de Testing

| Capa | Framework | Librerías clave |
|---|---|---|
| Backend | Jest 30 | `ts-jest` 29, `mongodb-memory-server`, `supertest`, `ioredis-mock` |
| Frontend | Vitest 4 | `jsdom`, `@testing-library/react`, `@testing-library/user-event` |
| E2E | Playwright | Planeado, no implementado aún |

---

## Backend Tests

### Configuración

```bash
cd back
npm test            # Todos los tests
npm test -- --watch # Modo watch
```

Archivo de configuración: `jest.config.ts` (CommonJS, `testEnvironment: node`, `testMatch: **/__tests__/**/*.test.ts`).

### Características

- **mongodb-memory-server**: Cada suite levanta una instancia efímera de MongoDB 7 en memoria. No necesita MongoDB real.
- **ioredis-mock**: Redis simulado en memoria para tests de colas y caché.
- **Supertest**: Prueba endpoints Express 5 montando la app completa (middlewares + rutas).
- **Factory helpers**: Funciones reutilizables para crear personas, usuarios, etc. con datos mínimos.
- **Seeders por test**: Cada test siembra solo los datos que necesita; se limpia la BD entre suites.

### Patrón de test

```typescript
// back/src/__tests__/persons.test.ts
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../app';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('GET /api/persons', () => {
  it('devuelve lista paginada de personas', async () => {
    const res = await request(app).get('/api/persons');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
  });
});
```

### Cobertura actual

| Área | Archivo de test | Lo que cubre |
|---|---|---|
| Personas | `__tests__/persons.test.ts` | CRUD, dedup (idHash), cierre de caso |
| Autenticación | `__tests__/auth.test.ts` | Google OAuth, email login, CSRF, rate limit |
| Búsqueda | `__tests__/search.test.ts` | Búsqueda vectorial, filtros combinados |
| Administración | `__tests__/admin.test.ts` | CRUD usuarios, merge perfiles, API keys |
| Sincronización | `__tests__/disaster-sync.test.ts` | Scrapers, detección de cambios |
| Procesamiento por lotes | `__tests__/batch.test.ts` | Procesamiento batch de reportes |
| Workers | `__tests__/ia-processor.test.ts` | Worker IA con mocking de Anthropic/OpenAI |

### Cómo escribir un test nuevo

1. Crear archivo en `back/src/__tests__/`
2. Usar `MongoMemoryServer` para BD aislada
3. Usar `request(app)` de supertest para endpoints
4. No compartir estado entre tests (cada `it` es independiente)
5. Probar casos felices, errores de validación, y errores de autorización

---

## Frontend Tests

### Configuración

```bash
cd front
npm test            # Todos los tests
npm test -- --run   # Una sola ejecución (CI)
```

Archivo de configuración: `vitest.config.ts` (entorno `jsdom`, setup con `@testing-library/jest-dom`).

### Características

- **jsdom**: Simula el DOM del navegador en Node.js.
- **@testing-library/react**: Renderizado de componentes con queries accesibles (`getByRole`, `findByText`).
- **Mocks globales**: AuthContext, api service, IntersectionObserver, react-leaflet.
- **Snapshot tests**: Solo para componentes estáticos (evitar snapshots grandes que cambian frecuentemente).

### Cobertura actual

| Área | Archivo de test | Lo que cubre |
|---|---|---|
| App | `__tests__/App.test.tsx` | Ruteo por estado, navegación principal |
| Auth | `__tests__/Auth.test.tsx` | Login modal, formulario registro, Google OAuth |
| AuthModal | `__tests__/AuthModal.test.tsx` | Modal de autenticación, tabs login/register |
| Localización (offline) | `__tests__/offlineDb.test.ts` | Dexie CRUD, sincronización offline |
| Sincronización | `__tests__/sync.test.ts` | Background sync con Service Worker |

### Cómo escribir un test nuevo

1. Crear archivo en `front/src/__tests__/`
2. Usar `render()` de testing-library
3. Mockear dependencias externas (api, contextos, mapas)
4. Preferir queries accesibles (`getByRole`) sobre queries de test-id
5. No mockear lo que no es necesario — el test debe parecerse al uso real

```tsx
// Ejemplo de test de componente
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '../components/ui/Button';

describe('Button', () => {
  it('renderiza el texto y responde al click', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Enviar</Button>);
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

---

## Cobertura Mínima por CI

El workflow de CI (`.github/workflows/ci.yml`) ejecuta:

```yaml
- run: cd back && npm test
- run: cd front && npm test
```

No hay gate de cobertura porcentual numérica, pero **todo código nuevo debe incluir tests**. La revisión humana en el PR verifica que:

1. Los tests nuevos efectivamente fallan si se revierte el cambio.
2. No se mockea en exceso (preferir integración sobre unitario en backend).
3. Casos borde están cubiertos (límites, nulos, vacío, errores de red).

---

## Tests de Workers (BullMQ)

Los workers se testean con:

- **Jobs directos**: Se instancia el worker con un job simulado y se verifica el resultado en BD.
- **ioredis-mock**: Redis simulado para la cola BullMQ.
- **Sin conexión real**: No depende de Redis ni MongoDB externos.

```typescript
// Ejemplo de test de worker
describe('IA Processor Worker', () => {
  it('procesa un reporte y genera embedding', async () => {
    const person = await createTestPerson({ name: 'María Pérez' });
    const job = { data: { personId: person._id } };
    await iaProcessor(job as any);
    const updated = await PersonModel.findById(person._id);
    expect(updated.embedding).toBeDefined();
  });
});
```

---

## Tests de Visión (Python)

Los tests del microservicio `vision/` se ejecutan por separado con `pytest`:

```bash
cd vision
pip install -r requirements-dev.txt
pytest
```

Cubren:
- Extracción de rostros desde imágenes de prueba.
- Blur de rostros (verificar que la región está efectivamente pixelada).
- Endpoints FastAPI (`/extract-face`, `/blur-faces`, `/health`).

---

## Reglas de Contribución

| Regla | Explicación |
|---|---|
| 1. **Test por bug** | Todo bug fix incluye un test que reproduce el bug antes de aplicar el fix |
| 2. **No tests rotos en main** | El CI debe pasar en main. Tests rotos = revertir |
| 3. **Mock mínimo** | En backend, preferir `mongodb-memory-server` antes que mockear Mongoose |
| 4. **Sin `it.skip` o `describe.skip`** | Si un test no corre, se elimina o se arregla |
| 5. **Nombres descriptivos** | `it('rechaza registro con email inválido')`, no `it('test3')` |
| 6. **Un assert conceptual por test** | Varios `expect` están bien si verifican la misma unidad lógica |

---

## Comandos Rápidos

```bash
# Backend
cd back && npm test                           # Todos los tests
cd back && npm test -- --testNamePattern="auth" # Tests que contengan "auth"
cd back && npm test -- --watch                # Modo watch

# Frontend
cd front && npm test                          # Todos los tests (Vitest UI si hay)
cd front && npm test -- --run                 # Una sola ejecución
cd front && npm test -- --coverage            # Reporte de cobertura

# Visión
cd vision && pytest                           # Tests Python
cd vision && pytest -v                        # Verbose
```