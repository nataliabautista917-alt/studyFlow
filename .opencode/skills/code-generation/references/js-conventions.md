# Convenciones JavaScript del proyecto

## Módulos

- Un módulo = una responsabilidad. `domain` no conoce `storage` ni `app`.
- Exportaciones nombradas; evita `default` salvo en componentes únicos.
- Constantes en `UPPER_SNAKE_CASE`, congeladas cuando son enums.

## Funciones

- Verbo + sustantivo: `createTask`, `computeStats`, `filterTasks`.
- Máximo ~40 líneas y 3 parámetros; usa un objeto de opciones.
- Devuelve valores; no escribas en variables globales.
- Errores de validación con `ValidationError(message, field)`.

## Fechas

```js
// MAL: interpreta UTC y puede retroceder un día en zonas negativas.
new Date("2026-11-12");

// BIEN: construye una fecha local a partir de las partes.
function parseDateOnly(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// BIEN: compara strings YYYY-MM-DD en hora local.
const today = toDateOnly(new Date()); // "2026-11-12"
const overdue = task.dueDate < today;
```

## Inmutabilidad

```js
tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
tasks.filter((t) => t.id !== id);
[...tasks].sort(compare);
```

## DOM seguro

```js
element.textContent = task.title;          // seguro
element.innerHTML = escapeHtml(task.title); // solo si necesitas marcado
```

## Accesibilidad en JS

- Al abrir un diálogo: guarda el elemento activo, enfoca el primer campo,
  atrapa Tab dentro y restaura el foco al cerrar.
- Anuncia resultados en `[aria-live="polite"]`.
- No dependas solo de `:hover`; añade `:focus-visible`.

## Anti-patrones

| Evitar | Alternativa |
| --- | --- |
| `==` | `===` |
| `var` | `const` / `let` |
| Fechas con `new Date(string)` para date-only | `parseDateOnly` local |
| `JSON.parse` sin `try/catch` | Validar y devolver error |
| `array.sort` sobre estado | `toSorted` o copia |
| `document` en dominio | Inyectar datos |
