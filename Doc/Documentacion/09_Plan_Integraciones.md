# Plan de Integración de Fuentes Oficiales (Fase D)

Este documento traza la hoja de ruta técnica para conectar Reencuentro Terremoto Venezuela con 6 fuentes institucionales venezolanas (FUNVISIS, INAMEH, Protección Civil, CNE/SAIME, Cruz Roja y Corpoelec). El objetivo es centralizar alertas vitales y mostrar datos referenciales con soporte **offline** y protección **anti-duplicación**.

## 🏗 Arquitectura de las Soluciones (Scraping y APIs)

Para cada fuente implementaremos dos rutas de extracción:
1. **Solución Actual (Algorítmica/Heurística):** Extracción vía selectores HTML (Cheerio) o APIs REST públicas. Deduplicación mediante Hashes MD5 (`sync-state.service.ts`) comparando campos exactos.
2. **Solución Futura (IA):** Extracción usando Puppeteer/Playwright para leer comunicados en imágenes o PDFs y transformarlos en texto estructurado con LangChain/OpenAI. Deduplicación vía Embeddings Vectoriales (pgvector) interpretando el contexto semántico de la alerta (para no duplicar reportes escritos de manera diferente).

## 📅 Fases del Desarrollo

### Fase 1: Motor Base y Fuentes API-Friendly (FUNVISIS y CNE)
**Backend:**
- Configuración de la base para Ingesta Institucional (cron jobs modulares).
- Creación de `funvisis.job.ts` (Sismología).
- Creación de wrapper API `cne-validator.service.ts` (Validación de identidad).
- **Tests:** Unitarios con Jest y Supertest (mockeando las respuestas del gobierno para no saturarlos).
- *Commit esperado:* `feat(ingesta): integrar motor base para apis de funvisis y cne`

**Frontend:**
- Creación del componente `<MapLegend />` modular y extraído a `.css` puro (sin inline-styles).
- Integrar la funcionalidad de autocompletado/verificación en el formulario de reporte usando la API del CNE.
- **Offline:** Actualizar PWA e IndexedDB para persistir el caché de las alertas sismológicas.
- *Commit esperado:* `feat(mapa): implementar leyendas sismologicas y cache offline de funvisis`

### Fase 2: Scraping Complejo y Alertas Climáticas (INAMEH y Corpoelec)
**Backend:**
- Creación de `inameh.job.ts` (Lluvias, Ríos) mediante scrapping HTML (Cheerio).
- Creación de `corpoelec.job.ts` (Servicios Básicos).
- Lógica de deduplicación heurística: Comparar Estado/Municipio + Fecha de alerta.
- *Commit esperado:* `feat(scraping): implementar extraccion heuristica para inameh y corpoelec`

**Frontend:**
- Actualización de `Map.tsx`: Añadir sistema de "Capas/Filtros" (Lluvias, Electricidad, Sismos).
- Componentes responsivos (`MapFilters.tsx`) adaptables a mobile-first, tablet, desktop y ultra-wide (1440px).
- Indicadores visuales de "Fuente Pública" con referencias bibliográficas al ente rector.
- **Tests:** Unitarios de UI para simular interacción de capas offline.
- *Commit esperado:* `feat(ui): implementar filtros multicapa y ui responsiva para alertas ambientales`

### Fase 3: Logística de Refugios (PC y Cruz Roja)
**Backend:**
- Creación de `proteccion-civil.job.ts` (Refugios y vías cerradas).
- Creación de `cruz-roja.job.ts` (Insumos médicos y donantes de sangre).
- *Commit esperado:* `feat(logistica): ingesta de refugios e insumos medicos desde pc y cruz roja`

**Frontend:**
- Tarjetas informativas de rutas colapsadas y listados de centros de acopio.
- UI hiper-optimizada para bajo consumo de batería y sin conexión a internet.
- *Commit esperado:* `feat(logistica): vistas offline de rutas y refugios habilitados`

## 💻 Convenciones de Código
- **Estilos Modulares:** Se priorizan clases BEM o similares en `.css` separados.
- **Estructura Clean Code:** Jobs en `back/src/jobs/`, Parsers aislados en `back/src/services/scrapers/`. 
- **Tono y UX Sensible:** Los mensajes de carga o error serán empáticos y transparentes. Ej: *"Descargando información oficial proporcionada por FUNVISIS (Caché local activo)"*.
