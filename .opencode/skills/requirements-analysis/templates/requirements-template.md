# Plantilla de requisitos

## 1. Problema y usuario

- **Usuario:** …
- **Necesidad:** …
- **Resultado esperado:** …

## 2. Alcance

### Must (v1)

- …

### Should (v1 si hay tiempo)

- …

### Won't (fuera de alcance)

- …

## 3. Requisitos funcionales

| ID | Requisito | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- |
| RF-1 | El sistema debe… | Must | Dado… cuando… entonces… |
| RF-2 | … | Should | … |

## 4. Requisitos no funcionales

| ID | Requisito | Métrica verificable |
| --- | --- | --- |
| RNF-1 | Accesibilidad | Navegación completa con teclado; labels asociados |
| RNF-2 | Rendimiento | Primer render < 100 ms con 500 tareas |
| RNF-3 | Persistencia | Los datos sobreviven a recarga sin backend |

## 5. Modelo de datos

| Campo | Tipo | Reglas | Ejemplo |
| --- | --- | --- | --- |
| id | string | único, no vacío | `tsk_...` |
| … | … | … | … |

## 6. Flujos principales

1. **Alta:** …
2. **Edición:** …
3. **Completar:** …
4. **Error:** …

## 7. Casos límite

- Campo vacío o solo espacios.
- Fecha de entrega hoy / ayer / sin fecha.
- Importación de JSON corrupto o de versión desconocida.
- Lista vacía y filtros sin resultados.

## 8. Trazabilidad

| Requisito | Criterio | Prueba prevista |
| --- | --- | --- |
| RF-1 | … | `tests/domain.test.js` › … |

## 9. Preguntas abiertas

- [ ] …
