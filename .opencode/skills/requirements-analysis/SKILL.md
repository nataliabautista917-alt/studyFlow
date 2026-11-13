---
name: Requirements Analysis
description: Convierte una solicitación vaga en requisitos verificables, criterios de aceptación y trazabilidad antes de diseñar o programar.
metadata:
  owner: architect
  phase: discovery
---

# Requirements Analysis

Usa esta skill cuando haya que entender qué construir, delimitar alcance,
priorizar funciones o convertir una idea en algo que se pueda probar.

## Flujo

1. **Reformular el problema** en una frase: usuario + necesidad + resultado.
2. **Identificar actores y escenarios** principales (camino feliz y fracasos).
3. **Separar alcance** con MoSCoW: Must, Should, Could, Won't (v1).
4. **Escribir requisitos funcionales** con identificador `RF-n`, en formato
   "el sistema debe…". Un requisito = una capacidad observable.
5. **Escribir requisitos no funcionales** medibles: rendimiento, accesibilidad,
   compatibilidad, privacidad, mantenibilidad.
6. **Definir criterios de aceptación** con Given/When/Then. Deben poder
   convertirse directamente en pruebas.
7. **Construir la matriz de trazabilidad** requisito → criterio → prueba prevista.
8. **Revisar ambigüedades**: "rápido", "fácil", "bonito", "muchos" no son
   requisitos hasta que tengan un umbral.
9. **Entregar el documento** en `docs/REQUIREMENTS.md` y avisar al Developer.

## Reglas de calidad

- Cada `RF` tiene al menos un criterio de aceptación verificable.
- Cada criterio indica datos de entrada, acción y resultado esperado.
- Los límites (mínimo, máximo, vacío, duplicado, fecha pasada) están escritos.
- Lo que no se construye aparece explícitamente en "Fuera de alcance".
- No se inventan integraciones ni datos que el usuario no haya pedido.

## Plantillas y referencias

- `templates/requirements-template.md`: estructura de entrega.
- `references/invest-and-acceptance.md`: técnica INVEST, MoSCoW y ejemplos.
- `references/traceability-example.md`: matriz de ejemplo para un CRUD.

## Criterio de salida

El Architect puede responder "sí/no" a cada criterio de aceptación sin
preguntar nada más. Si necesita preguntar, el requisito sigue ambiguo.
