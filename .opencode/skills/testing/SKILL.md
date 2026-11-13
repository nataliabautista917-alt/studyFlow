---
name: Testing
description: Diseña y ejecuta pruebas independientes, reproduce bugs, escribe regresiones y entrega un reporte con evidencia verificable.
metadata:
  owner: tester
  phase: verification
---

# Testing

Usa esta skill para verificar una entrega, reproducir un fallo, ampliar la
cobertura o decidir si una versión puede considerarse terminada.

## Estrategia

1. **Derivar pruebas de los requisitos**, no de la implementación. Cada
   criterio de aceptación debe tener al menos una prueba.
2. **Priorizar el riesgo:** validación, fechas, persistencia, importación y
   pérdida de datos antes que detalles cosméticos.
3. **Combinar niveles:**
   - unitarias de dominio (rápidas, deterministas);
   - almacenamiento con un fake en memoria;
   - integración del flujo crear → filtrar → completar → exportar → importar;
   - smoke test de arranque y sintaxis.
4. **Probar límites:** vacío, solo espacios, mínimo/máximo, hoy, ayer, mañana,
   duplicados, JSON corrupto, versión desconocida, lista vacía.
5. **Reproducir antes de corregir.** Registra pasos, esperado, obtenido.
6. **Escribir la regresión** que falla con el bug y pasa con el arreglo.
7. **Re-ejecutar la suite completa**, no solo la prueba nueva.
8. **Reportar** en `docs/TEST_REPORT.md` con comando, salida y veredicto.

## Reglas

- Una prueba debe fallar por una razón clara; evita aserciones gigantes.
- Nada de dependencias de red, reloj real o `Math.random` sin inyectar.
- No modifiques el código de producción para hacer pasar una prueba; si el
  contrato está mal, repórtalo al Architect.
- No declares "funciona" sin evidencia: comando, salida o captura.
- Los bugs se clasifican `S1` (pérdida de datos/bloqueo), `S2` (función
  incorrecta), `S3` (UX/estética), `S4` (menor).

## Plantillas y referencias

- `templates/bug-report.md`: reporte reproducible.
- `references/test-matrix.md`: mapa requisito → prueba.
- `references/node-test-recipes.md`: recetas de `node:test`.

## Criterio de salida

Suite completa en verde, cobertura de los requisitos Must, cero bugs S1/S2
abiertos y un veredicto explícito: **APROBADO** o **RECHAZADO** con motivos.
