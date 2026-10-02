"use client";

import { useEffect, useMemo, useState } from "react";

type Vehicle = {
  entityId: string | null;
  tripId: string | null;
  vehicleId: string | null;
  label: string | null;
  latitude: number | null;
  longitude: number | null;
  currentStatus: string | null;
  stopId: string | null;
  timestamp: string | null;
  branch: "unresolved";
};

type VehiclesResponse = {
  source: string;
  feedTimestamp: string | null;
  count: number;
  vehicles: Vehicle[];
};

const route = [
  "Alcobendas-S.S. de los Reyes",
  "Valdelasfuentes",
  "Universidad P. Comillas",
  "Cantoblanco Universidad",
  "Fuencarral",
  "Chamartín-Clara Campoamor",
];

export default function Home() {
  const [data, setData] = useState<VehiclesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/renfe/vehicles", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData((await response.json()) as VehiclesResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer Renfe");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, []);

  const located = useMemo(
    () => data?.vehicles.filter((vehicle) => vehicle.latitude !== null && vehicle.longitude !== null) ?? [],
    [data],
  );

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">MADRID TRANSIT LAB · v0.0.1</p>
        <h1>Alcobendas → Chamartín</h1>
        <p className="sub">Caso patrón: C-4a. Seguimiento real primero; fuegos artificiales después.</p>
      </header>

      <section className="statusCard" aria-live="polite">
        <div>
          <span className="label">Feed Renfe</span>
          <strong>{loading ? "Actualizando…" : error ? "Error" : "Conectado"}</strong>
        </div>
        <div>
          <span className="label">Vehículos C4 detectados</span>
          <strong>{data?.count ?? "—"}</strong>
        </div>
        <div>
          <span className="label">Con GPS</span>
          <strong>{located.length}</strong>
        </div>
        <button onClick={() => void refresh()} disabled={loading}>Actualizar</button>
      </section>

      {error ? <p className="error">No hemos podido consultar el feed: {error}</p> : null}

      <section className="panel">
        <h2>Tu trayecto de prueba</h2>
        <ol className="route">
          {route.map((stop, index) => (
            <li key={stop} className={index === route.length - 1 ? "target" : ""}>
              <span className="dot" aria-hidden="true" />
              <span>{stop}</span>
              {index === route.length - 1 ? <b> 🎯</b> : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <div className="sectionHeading">
          <div>
            <h2>Vehículos C4 visibles ahora</h2>
            <p>Diagnóstico del feed. Todavía no afirmamos cuál es C-4a hasta cruzarlo con GTFS estático.</p>
          </div>
          <span className="badge">P0-01</span>
        </div>
        <div className="vehicleGrid">
          {(data?.vehicles ?? []).slice(0, 12).map((vehicle, index) => (
            <article className="vehicle" key={vehicle.entityId ?? vehicle.tripId ?? `vehicle-${index}`}>
              <strong>{vehicle.label ?? vehicle.vehicleId ?? "C4"}</strong>
              <span>{vehicle.currentStatus ?? "Estado desconocido"}</span>
              <span>stopId: {vehicle.stopId ?? "—"}</span>
              <span>
                GPS: {vehicle.latitude?.toFixed(5) ?? "—"}, {vehicle.longitude?.toFixed(5) ?? "—"}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="nextCard">
        <span className="badge">SIGUIENTE</span>
        <h2>Resolver C-4a de forma fiable</h2>
        <p>GTFS estático + tripId + secuencia de paradas. Después activamos “Voy en este tren” y la alerta antes de Chamartín.</p>
      </section>
    </main>
  );
}
