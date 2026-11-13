# Checklist de accesibilidad

## Estructura

- [ ] Un solo `h1` y jerarquía sin saltos.
- [ ] Landmarks: `header`, `main`, `nav`, `footer` cuando aplique.
- [ ] El orden del DOM coincide con el orden visual.
- [ ] Los botones son `button`; los enlaces navegan con `a`.

## Teclado

- [ ] Todo interactivo recibe foco con Tab.
- [ ] El foco es visible (no `outline: none` sin reemplazo).
- [ ] Enter/Space activan botones.
- [ ] Escape cierra diálogos.
- [ ] El foco se mueve al abrir un diálogo y vuelve al disparador al cerrar.
- [ ] No hay trampas de foco fuera de diálogos modales.

## Formularios

- [ ] Cada campo tiene `label` asociado con `for`/`id`.
- [ ] Los errores están junto al campo y enlazados con `aria-describedby`.
- [ ] `required` y `aria-invalid` reflejan el estado real.
- [ ] Los mensajes de éxito/error se anuncian con `role="status"` o `aria-live`.

## Color y movimiento

- [ ] Contraste de texto ≥ 4.5:1; texto grande ≥ 3:1.
- [ ] El color no es el único indicador.
- [ ] `prefers-reduced-motion` desactiva animaciones no esenciales.
- [ ] Objetivos táctiles ≥ 40×40 px.

## Responsive

- [ ] Sin scroll horizontal a 360 px.
- [ ] Texto legible sin zoom forzado.
- [ ] Diálogos caben en viewport pequeño y hacen scroll interno.
