---
name: UI Design
description: Diseña interfaces claras, accesibles y responsive con tokens, estados completos y criterios de handoff verificables.
metadata:
  owner: architect
  phase: design
---

# UI Design

Usa esta skill antes de escribir HTML/CSS o cuando haya que revisar jerarquía,
accesibilidad, responsive o consistencia visual.

## Flujo

1. **Definir la tarea principal** de la pantalla en una frase. Todo lo demás es
   secundario.
2. **Elegir layout** mobile-first: una columna → dos columnas → panel lateral.
3. **Establecer tokens**: color, tipografía, espaciado, radios, sombras, foco y
   movimiento. Nunca valores mágicos repetidos.
4. **Diseñar los estados**, no solo el camino feliz: vacío, cargando, error,
   éxito, deshabilitado, hover, focus, seleccionado, vencido.
5. **Verificar accesibilidad**: contraste AA, foco visible, labels, roles,
   orden de tabulación, `aria-live` para cambios dinámicos y movimiento reducido.
6. **Comprobar responsive** a 360 px, 768 px y 1280 px.
7. **Entregar el spec** en `docs/UI_SPEC.md` con jerarquía, tokens, componentes,
   estados y criterios de aceptación visual.

## Reglas

- Un solo `h1`; jerarquía de encabezados sin saltos.
- El color no es el único portador de significado (prioridad lleva texto).
- Objetivos táctiles de al menos 40×40 px.
- Formularios con `label` real, `aria-describedby` para ayudas y errores.
- Los cambios de estado se anuncian en una región `aria-live="polite"`.
- El modo oscuro usa tokens semánticos, no inversión automática.
- Respeta `prefers-reduced-motion`.

## Plantillas y referencias

- `templates/ui-spec-template.md`: entrega de diseño.
- `references/design-tokens.md`: escala y tokens base.
- `references/accessibility-checklist.md`: auditoría rápida.

## Criterio de salida

El Developer puede construir la pantalla sin preguntar por colores, tamaños,
estados ni comportamiento responsive. Cada componente tiene sus estados
descritos y una forma objetiva de comprobarlo.
