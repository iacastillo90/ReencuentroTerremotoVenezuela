# AGENTS.md — Reencuentro Terremoto Venezuela

## Archivos de instrucciones por área

Este archivo es un despachador. Carga el sub-archivo correspondiente al área donde trabajes:

| Si trabajas en… | Lee también |
|---|---|
| `back/` | `back/AGENTS.md` |
| `front/` | `front/AGENTS.md` |
| `vision/` | `vision/AGENTS.md` |

**Siempre lee el sub-archivo antes de editar código en ese directorio.**

---

## Skills que debe cargar este proyecto

Carga estos skills según la tarea (usa la herramienta `skill`):

| Skill | Cuándo usarlo |
|---|---|
| `react-19` | Componentes, hooks, compilador, Server Components |
| `typescript` | Tipos, genéricos, configuración estricta |
| `zod-4` | Validación de esquemas en backend (`back/src/validators/`) |
| `security-checklist` | OWASP, endpoints, headers, rate limiting |
| `form-security` | Formularios de reporte, input handling, XSS |
| `firecrawl` | Web scraping para ingesta de datos (`back/src/services/scrapers/`) |
| `playwright` | Tests E2E si se añaden en el futuro |
| `category-api-design` | Diseño de endpoints REST, filtros, paginación |
| `gsap-core` + `gsap-react` | Animaciones en el frontend (si se agregan) |
| `github-pr` | Creación de PRs siguiendo conventional commits |
| `skill-registry` | Registrar/actualizar skills del proyecto |
| `sdd-propose` / `sdd-spec` / `sdd-design` / `sdd-tasks` / `sdd-apply` / `sdd-verify` | Flujo SDD (Spec-Driven Development) para cambios grandes |
| `sdd-archive` | Archivar cambios SDD completados |
| `sdd-init` | Inicializar SDD en un proyecto |
| `sdd-explore` | Explorar ideas antes de proponer cambios |
| `customize-opencode` | Configurar opencode.json o archivos del agente |

## Uso obligatorio de Context7 MCP

Antes de escribir o modificar código que use alguna librería/framework, usa **Context7** (`context7_resolve-library-id` + `context7_query-docs`) para consultar la documentación actualizada. Esto aplica a:

- React 19, React Router 7
- Express 5, Mongoose 9
- Zod 4, BullMQ 5
- Cualquier otra dependencia del `package.json`

No asumas que conoces la API de memoria — las versiones pueden tener breaking changes.
