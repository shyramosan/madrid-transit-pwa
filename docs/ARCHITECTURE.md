# Arquitectura inicial

```text
Renfe vehicle_positions.json ─┐
Renfe trip_updates.json ──────┼─> API server-side / normalizador
GTFS estático Cercanías ──────┘              │
                                              ▼
                                      Journey Engine
                                              │
                          ┌───────────────────┼──────────────────┐
                          ▼                   ▼                  ▼
                         ETA             Active Journey       Alerts
                          └───────────────────┼──────────────────┘
                                              ▼
                                         Next.js PWA
```

## Principios
1. Fuente oficial antes que heurística.
2. No mostrar precisión que no tenemos.
3. Las alertas críticas deben poder apoyarse en GPS del móvil.
4. La IA no participa en decisiones de tiempo real P0.
5. Alcance inicial: un trayecto real y verificable.
