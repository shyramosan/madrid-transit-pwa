# Madrid Transit Lab

Prototipo PWA para transporte público en tiempo real, empezando por **C-4a Alcobendas-S.S. de los Reyes → Chamartín-Clara Campoamor**.

## v0.0.1

Esta versión demuestra el primer eslabón técnico:

- consulta server-side de Renfe Open Data;
- lectura de `vehicle_positions.json`;
- filtrado diagnóstico de vehículos C4;
- refresco cada 20 segundos;
- interfaz mobile-first;
- ruta patrón visible;
- evita afirmar C-4a/C-4b hasta cruzar realtime con GTFS estático.

## Arranque

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Endpoints

- `/api/renfe/vehicles` → vehículos C4 normalizados
- `/api/renfe/trips` → feed de trip updates para diagnóstico

## Fuentes oficiales usadas

- Renfe Open Data: `https://gtfsrt.renfe.com/vehicle_positions.json`
- Renfe Open Data: `https://gtfsrt.renfe.com/trip_updates.json`
- CRTM: GTFS/red de Cercanías para la siguiente fase

## Siguiente milestone

**P0-02**: descargar/importar GTFS estático, resolver C-4a frente a C-4b mediante `tripId` y secuencia de paradas, y seleccionar automáticamente el viaje Alcobendas → Chamartín.
