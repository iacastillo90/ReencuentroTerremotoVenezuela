---
description: Revisa el diff actual en busca de errores, calidad y riesgos de privacidad/seguridad antes de confirmar.
argument-hint: (opcional) área o archivo a enfocar
---

Revisa los cambios actuales del repositorio $ARGUMENTS antes de confirmar.

1. Ejecuta el agente `code-reviewer` sobre el diff (`git diff`/`git status`): correctitud, consistencia con el stack, calidad y pruebas.
2. Ejecuta el agente `privacy-guardian`: privacidad de menores (LOPNNA), PII y seguridad.
3. Consolida ambos reportes en una lista priorizada (🔴/🟠/🟡) con archivo:línea y corrección recomendada.
4. Indícame si está **listo para confirmar** o qué falta. Dame los comandos manuales (tests, commit) — **no ejecutes Docker ni git push**.
