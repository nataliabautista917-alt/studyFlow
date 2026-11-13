# Ejemplo de trazabilidad

| ID | Requisito | Criterio de aceptación | Prueba |
| --- | --- | --- | --- |
| RF-1 | Crear tarea | Dado un formulario válido, al guardar se agrega una tarea con estado `pendiente` | `crea una tarea con valores por defecto` |
| RF-2 | Validar título | Dado un título vacío, al guardar se muestra "El título es obligatorio" y no se crea | `rechaza título vacío` |
| RF-3 | Completar tarea | Dada una tarea pendiente, al completarla su estado es `completada` y registra `completedAt` | `marca una tarea como completada` |
| RF-4 | Detectar vencidas | Dada una tarea no completada con fecha anterior a hoy, cuenta como vencida | `no cuenta tareas completadas como vencidas` |
| RF-5 | Persistir | Dado un estado guardado, al recargar se recuperan las mismas tareas | `round-trip de guardado y carga` |
| RF-6 | Importar | Dado un JSON con versión desconocida, se rechaza sin tocar el estado | `rechaza una versión desconocida` |
| RF-7 | Filtrar | Dados filtros de estado y curso, solo se muestran coincidencias | `combina filtros sin mutar` |
| RF-8 | Exportar | Al exportar se obtiene JSON parseable con versión y tareas | `exporta un documento parseable` |
