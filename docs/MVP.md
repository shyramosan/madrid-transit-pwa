# MVP · Madrid Transit Lab

## Caso patrón P0

**C-4a · Alcobendas-S.S. de los Reyes → Chamartín-Clara Campoamor**

### P0-01 · Feed real
- [x] Proxy server-side a `vehicle_positions.json`
- [x] Actualización cada 20 s
- [x] Normalización mínima de vehículos C4
- [x] No afirmar C-4a/C-4b sin resolver el viaje

### P0-02 · Resolver rama y sentido
- [ ] Importar GTFS estático de Cercanías
- [ ] Cruzar `tripId` realtime con `trips.txt`
- [ ] Resolver `route_id`, sentido, `stop_sequence`
- [ ] Identificar trayecto Alcobendas → Chamartín

### P0-03 · Viaje activo
- [ ] Acción “Voy en este tren”
- [ ] Mostrar estación actual / siguiente
- [ ] Calcular estaciones restantes
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
