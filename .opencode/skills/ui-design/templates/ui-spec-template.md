# Spec de interfaz

## 1. Objetivo de la pantalla

- **Usuario:** …
- **Tarea principal:** …
- **Métrica de éxito:** …

## 2. Jerarquía

1. `h1`: …
2. Resumen / métricas: …
3. Acción primaria: …
4. Filtros: …
5. Lista o tablero: …

## 3. Layout

| Breakpoint | Columnas | Navegación | Cambios |
| --- | --- | --- | --- |
| 360 px | 1 | … | … |
| 768 px | 2 | … | … |
| 1280 px | 2 + panel | … | … |

## 4. Tokens

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | … | Fondo |
| `--surface` | … | Tarjetas |
| `--text` | … | Texto principal |
| `--accent` | … | Acción primaria |
| `--danger` | … | Errores y vencidas |
| `--radius` | … | Bordes |
| `--space-*` | … | Escala de 4 px |

## 5. Componentes

### Tarjeta de tarea

- **Contenido:** título, curso, tipo, fecha, prioridad, estado, acciones.
- **Estados:** pendiente, en progreso, completada, vencida, foco, hover.
- **Teclado:** Tab a acciones, Enter/Space activa.
- **ARIA:** artículo con nombre accesible; estado en texto.

### Formulario

- **Campos y validación:** …
- **Errores:** junto al campo + resumen `aria-live`.
- **Foco inicial:** primer campo.
- **Cierre:** Escape cierra sin guardar.

## 6. Estados globales

| Estado | Comportamiento visual | Anuncio |
| --- | --- | --- |
| Vacío inicial | … | … |
| Sin resultados | … | … |
| Error de importación | … | … |
| Éxito al guardar | … | … |

## 7. Accesibilidad

- [ ] Contraste AA en claro y oscuro.
- [ ] Foco visible en todos los interactivos.
- [ ] Labels y ayudas asociados.
- [ ] Región `aria-live` para feedback.
- [ ] Sin scroll horizontal a 360 px.
- [ ] `prefers-reduced-motion` respetado.

## 8. Criterios de aceptación visual

1. …
2. …
