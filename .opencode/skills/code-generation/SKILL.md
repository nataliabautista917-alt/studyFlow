---
name: Code Generation
description: Implementa código modular, legible y comprobable a partir de requisitos y un spec de UI aprobados, con manejo explícito de errores.
metadata:
  owner: developer
  phase: implementation
---

# Code Generation

Usa esta skill cuando vayas a crear o modificar código de producción. El código
debe ser aburrido, explícito y fácil de probar, no ingenioso.

## Flujo

1. **Leer requisitos, arquitectura y UI spec.** Si falta un dato, anótalo como
   bloqueo; no inventes alcance.
2. **Definir el contrato** de cada módulo: entradas, salidas, errores y efectos.
3. **Separar lógica pura de efectos**: dominio sin DOM; almacenamiento con
   dependencias inyectadas; UI como composición de ambos.
4. **Escribir primero las estructuras** (constantes, validadores, funciones
   exportadas) y después la interfaz.
5. **Validar en la frontera**: formularios, JSON, `localStorage` y URL.
6. **Cubrir estados**: vacío, error, éxito, carga, deshabilitado.
7. **Probar mientras implementas**, no al final.
8. **Registrar decisiones y comandos** en `docs/DEVELOPMENT_LOG.md`.

## Contrato de calidad

- Funciones puras para reglas de negocio; sin `document` en el dominio.
- Sin mutación de argumentos: `map`, `filter`, `toSorted`, spread.
- IDs y reloj inyectables para pruebas deterministas.
- Errores con código y campo cuando sea validación.
- Nombres en inglés en el código; textos de interfaz en español.
- Sin `innerHTML` con datos del usuario (XSS). Usa `textContent` o `escapeHtml`.
- Sin dependencias nuevas si la plataforma ya resuelve el problema.
- Cada bug corregido incluye una prueba que falla sin el cambio.

## Plantillas y referencias

- `templates/module-template.js`: esqueleto de módulo puro.
- `references/js-conventions.md`: convenciones y errores comunes.
- `references/definition-of-done.md`: checklist antes de entregar al Tester.

## Criterio de salida

`npm run check` y `npm test` pasan en local; la funcionalidad se puede ejecutar
con `npm start`; el Tester recibe una lista de archivos, comandos y riesgos.
