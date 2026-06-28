# Especificación final — Reencuentro Terremoto Venezuela

Carpeta ordenada para **empezar la construcción**. El documento maestro consolida todo;
los originales quedan como respaldo trazable.

## Orden de lectura

| # | Archivo | Para qué sirve |
|---|---------|----------------|
| **1** | `01_Especificacion_Unificada.docx` / `.html` | **Documento maestro** (doble público: ejecutivo + técnico). Empieza aquí. |
| 2 | `originales/00_Detalles_del_proyecto.md` | Visión, retos y beneficios (origen del proyecto). |
| 3 | `originales/02_Modelo_de_datos_28-06.pdf` / `.drawio` | Modelo de datos relacional de 12 tablas (28/06) — el más reciente. |
| 4 | `originales/03_SPEC_MVP_v1.1.docx` | SPEC del MVP (módulos, IA, stack, seguridad). |
| 5 | `originales/07_Registro_y_login.docx` | Acceso, niveles y datos mínimos. |
| 6 | `originales/08_Buscar_persona_o_mascota.docx` | Detalle funcional del módulo Buscar (incl. menores). |
| 7 | `originales/04_TDD…` · `05_DevHub…` · `06_Guia_integraciones…` | Arquitectura del repo de Iván (referencia / motor de ingesta Post-MVP). |
| 8 | `mockups/` | Maquetas del equipo (onboarding, home, buscar, reportar, mapa, dashboard). |

## Decisiones congeladas (ver documento maestro, Anexo A)

- **Arquitectura canónica:** Next.js + Supabase (serverless). Repo destino: `pitonisaX/reencuentros-terremoto-vzla`.
- **Repo de Iván (`iacastillo90`):** referencia de UI + motor de ingesta/censo para Post-MVP (no se fusiona su backend).
- **Marca:** “Reencuentro Terremoto Venezuela / Juntos te encontramos”.
- **Alcance MVP:** Buscar · Reportar/Casos · Mensajería · Mapa · Login · Perfil.

## Estado de construcción

- ✅ **Módulo Búsqueda de Personas + Home + Reportar** — implementado y probado en local
  (rama `feat/busqueda-personas`). Ver `../ISSUE.md` y `../COMO-ENVIAR-EL-ISSUE.md`.
- ⏭️ Siguiente: login passwordless, mensajería (Realtime), mapa de calor (Leaflet), PWA offline,
  búsqueda semántica (pgvector).

## Prototipos

- App real navegable: `npm run dev` en el repo (mejor prototipo).
- `../prototipos/prototipos.html` — prototipos por página (autocontenido, para compartir).
