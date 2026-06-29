# Reencuentro Terremoto Venezuela — Guía para Claude Code

> Contexto y reglas para cualquier agente de Claude Code que trabaje en este repositorio.
> Objetivo: **mejorar y construir el proyecto de forma continua, segura y sin romper lo que ya funciona.**

## Qué es el proyecto
Plataforma humanitaria de código abierto (nombre interno: *AyudaVE*) que centraliza, deduplica y unifica reportes de personas desaparecidas/encontradas tras desastres naturales en Venezuela, con asistencia de IA. Integra **fuentes externas (scraping)** y **reportes ciudadanos** en una sola base unificada.

## Stack (NO se cambia)
- **Monorepo:** `front/` (React 19 + Vite + TypeScript, SPA + PWA, Leaflet, Google OAuth) y `back/` (Node + Express 5 + TypeScript).
- **Datos:** MongoDB (Mongoose) · **Colas/caché:** Redis + BullMQ · **Storage:** S3-compatible (MinIO local / Supabase prod).
- **IA:** abstracción de proveedor en `back/src/services/ai/` (`ai.factory` → anthropic/openai/gemini).
- **Despliegue:** front en Vercel, back (API + worker) en Render; Mongo Atlas; Upstash Redis; Supabase Storage.

## Mapa rápido del código
- `back/src/routes/` controladores Express · `back/src/services/` lógica (incl. `matcher.service`, `ai/`) · `back/src/models/` esquemas Mongoose (núcleo: `unified-person.model`) · `back/src/jobs/` cron de ingesta · `back/src/adapters/` normalizadores por fuente · `back/src/workers/` consumidores BullMQ.
- `front/src/pages/` vistas (Feed, Map, Library, Admin, Profile) · `front/src/services/api.ts` cliente HTTP.
- Docs: `Readme.md`, `DEVELOPERS.md`, `Integraciones.md`, `TDD.md`.

## ⛔ Reglas de oro (NO negociables)
1. **No ejecutar Docker ni comandos de infraestructura destructivos.** Nunca correr `docker compose build/up/down/prune`, `docker system prune`, ni borrar volúmenes. En su lugar, **redactar el comando exacto y pedir que lo ejecute la persona** (puede corromper imágenes). Igual para migraciones destructivas o `git push`.
2. **No cambiar el stack.** Mejoras *dentro* de Node/Express/Mongo/React/Vite. Nada de migrar a otro framework, lenguaje o base de datos sin aprobación explícita.
3. **Privacidad de menores (LOPNNA) primero.** Nunca exponer públicamente nombre/foto/ubicación exacta/contacto de menores (`age < 18`). Solo organizaciones verificadas acceden. **No enviar datos de menores a APIs de IA externas.** Minimizar PII en todo prompt.
4. **Humano en el bucle.** La IA *sugiere* coincidencias; una persona/organización **confirma** antes de notificar a una familia. Nunca declarar un reencuentro automáticamente.
5. **Cambios pequeños, enfocados y con pruebas.** Una mejora a la vez. Respetar el estilo existente (TypeScript, Zod en validators, patrón `idHash`+`upsert`). Correr tests cuando existan.
6. **Español claro y humano** en la UI; tono sereno, sin falsas promesas (diseño de crisis).

## Cómo se ejecuta en local (comandos para la persona, no para el agente)
```bash
cd ReencuentroTerremotoVenezuela
docker compose up -d            # infra local (Mongo/Redis/MinIO) — LO CORRE LA PERSONA
cd back  && npm install && npm run dev    # API  → http://localhost:4000
cd front && npm install && npm run dev    # Web  → http://localhost:5173
# Tests: (back) npm test  ·  (front) npm test
```
> El agente puede correr `npm test`, `npm run lint`, `tsc --noEmit` (no destructivos). **Docker lo corre la persona.**

## El equipo de agentes (`.claude/agents/`)
- **tech-lead** — planifica una mejora/feature y la divide en pasos (úsalo primero para tareas grandes).
- **backend-engineer** — Express/Mongoose/BullMQ.
- **frontend-engineer** — React/Vite/Leaflet/PWA/accesibilidad.
- **ai-matching-engineer** — matcher, embeddings (Atlas Vector Search), proveedores de IA, prompts.
- **source-integrator** — agrega nuevas fuentes de ingesta (job + adapter + `idHash`).
- **privacy-guardian** — revisa privacidad de menores/PII y seguridad (solo lectura).
- **code-reviewer** — revisa correctitud, calidad y pruebas antes de confirmar (solo lectura).
- **devops-deployer** — despliegue Vercel/Render y variables de entorno (entrega comandos manuales; no ejecuta Docker).

## Flujo recomendado (la "fábrica")
`tech-lead` (plan) → agente especialista (implementa) → `code-reviewer` + `privacy-guardian` (revisan) → la persona corre tests/commits/deploy con los comandos que el agente entregue.
