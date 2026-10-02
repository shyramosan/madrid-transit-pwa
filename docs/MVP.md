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
- [x] Acción “Voy en este tren”
- [x] Persistencia del tren elegido en `localStorage`
- [x] Mostrar estación actual / siguiente
- [x] Calcular estaciones restantes en UI
- [x] Visualizar recorrido y progreso hasta Chamartín
- [ ] Usar GPS del móvil como respaldo

### P0-04 · Alerta para bajar
- [ ] Solicitar permiso de notificaciones en contexto
- [ ] Aviso 2 estaciones antes
- [ ] Aviso 1 estación antes
- [ ] Vibración cuando esté disponible
- [ ] Evitar alertas duplicadas
- [ ] Fallback visible si las notificaciones están bloqueadas

### P0-05 · Aviso para salir
- [ ] Próximos trenes
- [ ] Aviso 5/10 min antes
- [ ] Después: cálculo por distancia andando

## Regla de calidad

No se mostrará “C-4a” basándonos únicamente en el texto `C4` del realtime. La rama se confirma por el recorrido GTFS y la secuencia real de paradas.

Las alertas de P0-04 no se consideran terminadas hasta probar permisos y comportamiento real en navegador/móvil.
