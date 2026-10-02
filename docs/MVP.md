# MVP · Madrid Transit Lab

## Caso patrón P0

**C-4a · Alcobendas-S.S. de los Reyes → Chamartín-Clara Campoamor**

### P0-01 · Feed real
- [x] Proxy server-side a `vehicle_positions.json`
- [x] Actualización cada 20 s
- [x] Normalización mínima de vehículos C4
- [x] No afirmar C-4a/C-4b sin resolver el viaje

### P0-02 · Resolver rama y sentido
- [x] Integración del GTFS estático oficial de Cercanías
- [x] Cruce de `tripId` realtime con `trips.txt`
- [x] Resolución de `route_id`, sentido y `stop_sequence`
- [x] Filtro automático Alcobendas → Chamartín
- [x] Cálculo de estación actual conocida y paradas restantes hasta Chamartín
- [ ] Validación runtime/build en entorno ejecutable

Endpoints:
- `/api/renfe/resolve?tripId=...` → resuelve un viaje concreto contra GTFS.
- `/api/renfe/c4a` → devuelve candidatos C4 activos cuyo recorrido contiene Alcobendas antes de Chamartín.

### P0-03 · Viaje activo
- [ ] Acción “Voy en este tren”
- [ ] Mostrar estación actual / siguiente
- [ ] Calcular estaciones restantes en UI
- [ ] Usar GPS del móvil como respaldo

### P0-04 · Alerta para bajar
- [ ] 2 estaciones antes
- [ ] 1 estación antes
- [ ] Vibración + notificación
- [ ] Evitar alertas duplicadas

### P0-05 · Aviso para salir
- [ ] Próximos trenes
- [ ] Aviso 5/10 min antes
- [ ] Después: cálculo por distancia andando

## Regla de calidad

No se mostrará “C-4a” basándonos únicamente en el texto `C4` del realtime. La rama se confirma por el recorrido GTFS y la secuencia real de paradas.
