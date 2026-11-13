# Recetas con `node:test`

## Estructura AAA

```js
import test from "node:test";
import assert from "node:assert/strict";

test("describe el comportamiento observable", () => {
  // Arrange
  const input = { title: "  Ensayo  " };
  // Act
  const task = createTask(input, { now: NOW, idFactory: () => "t1" });
  // Assert
  assert.equal(task.title, "Ensayo");
});
```

## Errores esperados

```js
assert.throws(
  () => createTask({}, { now: NOW, idFactory: () => "t1" }),
  (error) => error.name === "ValidationError" && error.field === "title",
);
```

## Fake de almacenamiento

```js
function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    dump: () => Object.fromEntries(data),
  };
}
```

## Reloj fijo

```js
const NOW = new Date(2026, 10, 12, 9, 0, 0); // 12 nov 2026, hora local
```

## Ejecutar un subconjunto

```sh
node --test --test-name-pattern="vencida"
node --test tests/domain.test.js
```

## Buenos nombres

- `crea una tarea con estado pendiente por defecto`
- `rechaza una fecha con formato inválido`
- `no cuenta tareas completadas como vencidas`
- `ordena por prioridad y desempata por fecha`

Evita `test 1`, `funciona` o `prueba de createTask`.
