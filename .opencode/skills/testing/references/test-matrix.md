# Matriz de pruebas — StudyFlow

| Requisito | Riesgo | Nivel | Prueba |
| --- | --- | --- | --- |
| RF-1 Crear tarea | Validación | Unitaria | `crea una tarea con valores por defecto` |
| RF-1 Crear tarea | Pérdida de datos | Integración | `ciclo de vida completo` |
| RF-2 Editar tarea | Inmutabilidad | Unitaria | `actualiza sin mutar la tarea original` |
| RF-2 Editar tarea | ID inexistente | Unitaria | `lanza error si la tarea no existe` |
| RF-3 Eliminar | ID inexistente | Unitaria | `elimina solo la tarea indicada` |
| RF-4 Estados | Transición inválida | Unitaria | `rechaza un estado desconocido` |
| RF-4 Estados | Completar | Unitaria | `registra completedAt al completar` |
| RF-5 Métricas | Vencidas | Unitaria | `no cuenta completadas como vencidas` |
| RF-5 Métricas | Límite hoy | Unitaria | `una tarea que vence hoy no está vencida` |
| RF-5 Métricas | Próximas 7 días | Unitaria | `cuenta próximas dentro de la ventana` |
| RF-6 Filtros | Combinación | Unitaria | `combina estado, curso y prioridad` |
| RF-6 Filtros | Búsqueda | Unitaria | `busca sin distinguir mayúsculas` |
| RF-7 Orden | Prioridad/fecha | Unitaria | `ordena por prioridad y desempata por fecha` |
| RF-8 Persistencia | Round-trip | Unitaria | `guarda y carga el mismo estado` |
| RF-8 Persistencia | Corrupto | Unitaria | `usa el estado inicial si el JSON es inválido` |
| RF-9 Importar | Versión | Unitaria | `rechaza versión desconocida` |
| RF-9 Importar | Forma | Unitaria | `rechaza tareas inválidas` |
| RF-10 Exportar | Parseable | Unitaria | `exporta JSON parseable` |
| RNF-1 Arranque | Sintaxis | Smoke | `npm run check` |
| RNF-2 Accesibilidad | Manual/estructural | Smoke | inspección de `index.html` |

## Datos de prueba

- **Hoy fijo:** `2026-11-12`
- **Vencida:** `2026-11-11`
- **Hoy:** `2026-11-12`
- **Próxima:** `2026-11-15`
- **Lejana:** `2026-12-01`

## Criterio de aprobación

- 100 % de los requisitos Must con al menos una prueba.
- 0 bugs S1/S2 abiertos.
- Suite reproducible con `npm test` sin red.
