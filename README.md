# StudyFlow — Gestor de tareas académicas

StudyFlow es una aplicación web para organizar y gestionar tareas académicas. Permite crear, editar, eliminar, filtrar y ordenar actividades, controlar su estado y consultar estadísticas del progreso.

El proyecto fue desarrollado utilizando **OpenCode** como entorno de desarrollo agéntico, mediante la colaboración de tres agentes especializados y cuatro skills.

## Objetivo del proyecto

Construir una aplicación funcional aplicando un flujo de desarrollo asistido por inteligencia artificial agéntica, en el que diferentes agentes colaboran para analizar los requerimientos, diseñar la solución, generar el código y verificar su funcionamiento.

## Equipo de agentes

| Agente | Responsabilidad |
|---|---|
| Architect | Analizar los requerimientos y definir la arquitectura de la aplicación. |
| Developer | Implementar las funcionalidades y desarrollar el código fuente. |
| Tester | Revisar la solución, detectar errores y ejecutar pruebas. |

## Skills utilizadas

1. **Requirements Analysis:** análisis y organización de requerimientos.
2. **UI Design:** definición de la interfaz y experiencia de usuario.
3. **Code Generation:** orientación para la generación e implementación del código.
4. **Testing:** planificación, ejecución y documentación de pruebas.

## Tecnologías y herramientas

- HTML
- CSS
- JavaScript (ES Modules)
- Node.js
- OpenCode
- Node.js Test Runner

## Funcionalidades

- Crear, editar y eliminar tareas académicas.
- Asignar cursos, fechas, prioridades y horas estimadas.
- Cambiar el estado de las tareas.
- Buscar y filtrar actividades.
- Ordenar tareas por fecha y prioridad.
- Consultar estadísticas y progreso académico.
- Cambiar entre tema claro y oscuro.
- Importar y exportar información en formato JSON.
- Conservar los datos mediante almacenamiento local.

## Estructura del proyecto

```text
gestorTareas/
├── .opencode/
│   ├── agents/
│   │   ├── architect.md
│   │   ├── developer.md
│   │   └── tester.md
│   └── skills/
│       ├── requirements-analysis/
│       ├── ui-design/
│       ├── code-generation/
│       └── testing/
├── src/
│   ├── app.js
│   ├── domain.js
│   └── storage.js
├── tests/
│   ├── helpers/
│   ├── app.test.js
│   ├── domain.test.js
│   ├── filters.test.js
│   ├── integration.test.js
│   ├── markup.test.js
│   ├── metrics.test.js
│   ├── performance.test.js
│   ├── regression.test.js
│   └── storage.test.js
├── docs/
├── scripts/
├── AGENTS.md
├── index.html
├── styles.css
├── package.json
└── opencode.jsonc
```

## Instalación y ejecución

Se requiere Node.js 20 o superior.

Clonar el repositorio:

```bash
git clone URL_DEL_REPOSITORIO
cd gestorTareas
```

Iniciar la aplicación:

```bash
npm start
```

Abrir en el navegador:

```text
http://localhost:4173
```

## Verificación y pruebas

Comprobar la sintaxis:

```bash
npm run check
```

Ejecutar las pruebas automatizadas:

```bash
npm test
```

### Resultados de verificación local

- **130 pruebas aprobadas.**
- **0 pruebas fallidas.**
- **0 pruebas omitidas.**
- Verificación sintáctica completada sin errores.
- Aplicación iniciada y comprobada localmente.

Las pruebas incluyen validaciones de dominio, almacenamiento, integración, regresión e interfaz mediante un DOM falso.

## Documentación

La carpeta `docs/` contiene los documentos de análisis, arquitectura, requerimientos, especificaciones de interfaz, registros de desarrollo y reportes de pruebas.

## Propósito académico

Este proyecto demuestra la aplicación de inteligencia artificial agéntica en un proceso de desarrollo de software, mediante agentes especializados que colaboran en diferentes etapas del ciclo de construcción y verificación de una aplicación.