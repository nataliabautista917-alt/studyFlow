# StudyFlow — Instrucciones del proyecto

## Objetivo

Construir y mantener **StudyFlow**, un gestor de tareas académicas para estudiantes.
La aplicación es un SPA sin backend, con módulos ES, persistencia en `localStorage`
y pruebas con el runner nativo de Node (`node:test`).

## Equipo de agentes

| Agente | Archivo | Rol |
| --- | --- | --- |
| Architect | `.opencode/agents/architect.md` | Requisitos, arquitectura, UX y coordinación |
| Developer | `.opencode/agents/developer.md` | Implementación y pruebas unitarias |
| Tester | `.opencode/agents/tester.md` | Verificación independiente, regresión y reporte |

El flujo obligatorio es **Architect → Developer → Tester → Developer (correcciones) → Tester (revalidación)**.
Ningún rol se salta su puerta de calidad.

## Skills del proyecto

- `.opencode/skills/requirements-analysis/SKILL.md`
- `.opencode/skills/ui-design/SKILL.md`
- `.opencode/skills/code-generation/SKILL.md`
- `.opencode/skills/testing/SKILL.md`

Cada agente debe cargar con la herramienta `skill` las skills indicadas en su
definición antes de empezar su fase y citar la skill usada en su bitácora.

## Mapa del repositorio

```text
index.html                 Punto de entrada del SPA
styles.css                 Tokens, layout y componentes visuales
src/domain.js              Reglas de negocio puras (sin DOM)
src/storage.js             Persistencia, importación y exportación
src/app.js                 Render, eventos y estado de interfaz
tests/                     Pruebas de dominio, almacenamiento e integración
docs/                      Brief, requisitos, arquitectura, UX y bitácoras
.opencode/agents/          Definiciones del equipo
.opencode/skills/          Conocimiento reutilizable del equipo
scripts/serve.mjs          Servidor estático local sin dependencias
```

## Comandos

```sh
npm test          # suite completa
npm run check     # validación sintáctica de los módulos
npm start         # servidor local en http://localhost:4173
```

## Reglas de ingeniería

1. `src/domain.js` no importa DOM ni `localStorage`; recibe fechas e IDs inyectables.
2. Las fechas de vencimiento son strings `YYYY-MM-DD` y se comparan en hora local,
   nunca con `new Date("YYYY-MM-DD")` (evita el desfase UTC).
3. Toda entrada externa (formulario, JSON importado, `localStorage`) se valida
   antes de entrar al estado.
4. No se mutan arreglos ni tareas: las operaciones devuelven nuevas estructuras.
5. La interfaz debe funcionar con teclado, tener etiquetas accesibles y respetar
   `prefers-reduced-motion`.
6. Cada corrección de bug debe venir con una prueba de regresión.

## Bitácoras

Cada fase deja evidencia en `docs/`:

- `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/UI_SPEC.md` (Architect)
- `docs/DEVELOPMENT_LOG.md` (Developer)
- `docs/TEST_REPORT.md` (Tester)

Formato de entrada:

```md
### [FASE] HH:MM — Título
- **Agente:** Architect | Developer | Tester
- **Skills usadas:** ...
- **Decisión / hallazgo:** ...
- **Evidencia:** archivo, comando o resultado
```
