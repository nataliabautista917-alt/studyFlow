# Definition of Done — Developer

## Código

- [ ] Requisitos Must implementados y trazables.
- [ ] Dominio puro, sin DOM ni `localStorage`.
- [ ] Validación en todas las fronteras.
- [ ] Sin mutación de argumentos.
- [ ] Sin `innerHTML` con datos no escapados.
- [ ] Estados vacío/error/éxito cubiertos en la UI.
- [ ] Fechas date-only sin desfase UTC.

## Pruebas

- [ ] Pruebas unitarias de reglas y validaciones.
- [ ] Pruebas de almacenamiento con fake inyectado.
- [ ] Prueba de integración del flujo principal.
- [ ] Casos límite: vacío, hoy, ayer, duplicado, JSON corrupto.
- [ ] `npm test` en verde.
- [ ] `npm run check` en verde.

## Entrega

- [ ] `docs/DEVELOPMENT_LOG.md` con decisiones, comandos y riesgos.
- [ ] Lista de archivos tocados.
- [ ] Nota al Tester con áreas de riesgo y qué no se pudo verificar.
- [ ] La app arranca con `npm start` sin errores de consola.
