# INVEST, MoSCoW y criterios de aceptación

## Historias INVEST

| Letra | Significado | Pregunta de control |
| --- | --- | --- |
| I | Independiente | ¿Se puede entregar sin otra historia? |
| N | Negociable | ¿Describe el valor, no la implementación? |
| V | Valiosa | ¿Resuelve algo para el usuario? |
| E | Estimable | ¿El equipo puede dimensionarla? |
| S | Small | ¿Cabe en una iteración corta? |
| T | Testeable | ¿Existe una observación objetiva de éxito? |

## Priorización MoSCoW

- **Must:** sin esto el producto no sirve.
- **Should:** importante, pero existe una alternativa manual.
- **Could:** deseable; se corta primero.
- **Won't:** se declara fuera de alcance para evitar crecimiento silencioso.

## Given / When / Then

```text
Dado un usuario con una tarea pendiente que vence ayer
Cuando abre el panel
Entonces la tarea aparece como vencida y suma 1 al contador "Vencidas".
```

Un buen criterio:

- usa datos concretos, no "algunos";
- describe una sola acción;
- tiene un resultado observable;
- cubre el caso límite relevante (hoy, vacío, duplicado).

## Antipatrones

| Antipatrón | Corrección |
| --- | --- |
| "La app debe ser rápida" | "El panel renderiza 500 tareas en < 100 ms" |
| "El diseño debe ser moderno" | "Usa una escala tipográfica de 4 niveles y contraste AA" |
| "Manejar errores" | "Un JSON inválido muestra un mensaje y no modifica el estado" |
| "Soportar móvil" | "A 360 px, las tarjetas pasan a una columna y no hay scroll horizontal" |
