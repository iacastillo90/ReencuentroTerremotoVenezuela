---
description: Crea una nueva fuente de ingesta (adapter + cron job) siguiendo el patrón del proyecto.
argument-hint: <nombre o URL de la fuente de datos>
---

Integra una nueva fuente de datos: **$ARGUMENTS**

Usa el agente `source-integrator` (lee `CLAUDE.md` e `Integraciones.md`). Debe:

1. Crear el **adapter** en `back/src/adapters/` extendiendo `base.adapter`, que obtenga y **normalice los datos al esquema `UnifiedPerson`** (o `DisasterEvent`).
2. Aplicar el patrón **fetch → transform → `idHash` → `upsert`** (idempotente, sin duplicados) y normalizar estados al vocabulario interno.
3. Crear el **job** en `back/src/jobs/` y registrar el estado en `SyncState`.
4. Agregar una **prueba mínima** del parseo.
5. **Privacidad:** marcar como protegidos los datos de menores; nunca exponerlos.

Al final: resume los archivos creados y dame el **comando manual** para disparar el sync (p. ej. `POST /api/admin/sync` con la `ADMIN_API_KEY`). No ejecutes Docker.
