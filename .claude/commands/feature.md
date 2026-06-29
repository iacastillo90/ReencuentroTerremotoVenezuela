---
description: Ciclo completo para construir una mejora/feature (planificar → implementar → revisar) respetando las reglas del proyecto.
argument-hint: <descripción de la feature o mejora>
---

Vamos a construir esto de forma segura y enfocada: **$ARGUMENTS**

Sigue la "fábrica" del proyecto (lee `CLAUDE.md` y respeta sus reglas de oro):

1. **Planificar:** usa el agente `tech-lead` para analizar el código y producir un plan por pasos (archivos a tocar, riesgos, agente responsable de cada parte). Muéstrame el plan antes de implementar.
2. **Implementar:** delega cada paso al especialista correcto (`backend-engineer`, `frontend-engineer`, `ai-matching-engineer` o `source-integrator`). Cambios pequeños y dentro del stack actual.
3. **Revisar:** ejecuta `code-reviewer` y, si se tocaron datos de personas/IA/API, también `privacy-guardian`. Corrige lo que marquen.
4. **Cerrar:** resume archivos tocados y dame los **comandos manuales** que debo correr yo (tests, levantar con Docker, commit). **No ejecutes Docker ni hagas git push.**
