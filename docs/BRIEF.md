# Brief del producto — StudyFlow

## Solicitud original

> Desarrollar un sistema de IA agéntica con OpenCode. El proyecto será un gestor
> de tareas académicas para estudiantes. Se requiere un equipo de mínimo tres
> agentes (Architect, Developer, Tester), cuatro skills independientes
> (requirements-analysis, ui-design, code-generation, testing), colaboración
> entre agentes y una aplicación funcional, probada, corregida y documentada.

## Usuario objetivo

Estudiantes universitarios o de secundaria que necesitan organizar tareas,
exámenes, proyectos y lecturas de varios cursos en un solo lugar, sin crear
cuentas ni depender de internet.

## Problema

Las tareas académicas llegan por múltiples canales (aulas virtuales, correo,
mensajería) y es fácil perder fechas de entrega, prioridades y carga de trabajo.
Las herramientas existentes suelen ser demasiado pesadas o requerir registro.

## Propuesta de valor

Un panel local, rápido y sin fricción que responde en menos de 10 segundos:
**¿qué debo hacer hoy y qué está en riesgo?**

## Alcance funcional (v1)

1. Crear, editar y eliminar tareas académicas.
2. Campos: título, curso, tipo, fecha de entrega, prioridad, horas estimadas y notas.
3. Estados: pendiente, en progreso, completada.
4. Panel con métricas: total, pendientes, en progreso, completadas, vencidas,
   próximas (7 días) y porcentaje de avance.
5. Búsqueda y filtros por estado, curso y prioridad; orden por fecha, prioridad
   y creación.
6. Persistencia en `localStorage` y datos de ejemplo en el primer arranque.
7. Importación/exportación JSON y restablecimiento de datos.
8. Diseño responsive, accesible y con tema claro/oscuro.

## Fuera de alcance (v1)

- Backend, autenticación, sincronización multidispositivo.
- Notificaciones push o correo.
- Adjuntos y colaboración entre usuarios.
- Integraciones con calendarios o aulas virtuales.

## Restricciones

- Sin dependencias de runtime ni build step.
- Debe abrirse con un servidor estático simple y funcionar offline.
- Pruebas ejecutables con `npm test` en Node 20+.
- Español como idioma de la interfaz y la documentación.

## Criterios de éxito

- `npm test` en verde con al menos 25 pruebas.
- Los flujos CRUD, filtros, métricas, persistencia e importación funcionan.
- Sin errores de consola al cargar la aplicación.
- Cada agente deja evidencia verificable de su participación.
