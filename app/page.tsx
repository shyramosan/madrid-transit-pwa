"use client";

import { useEffect, useMemo, useState } from "react";

type Stop = {
  stopId: string;
  stopName: string;
  stopSequence: number;
  arrivalTime: string | null;
  departureTime: string | null;
};

type Candidate = {
  vehicle: {
    entityId: string | null;
    tripId: string | null;
    vehicleId: string | null;
    label: string | null;
    latitude: number | null;
    longitude: number | null;
    currentStatus: string | null;
    stopId: string | null;
    timestamp: string | null;
  };
  trip: {
    tripId: string;
    routeId: string | null;
    routeShortName: string | null;
    routeLongName: string | null;
    tripHeadsign: string | null;
    directionId: string | null;
  };
  progress: {
    currentStop: Stop | null;
    nextKnownStop: Stop | null;
    chamartin: Stop | null;
    stopsToChamartin: number | null;
  };
  stops: Stop[];
};

type C4AResponse = {
  source: {
    realtime: string;
    static: string;
  };
  feedTimestamp: string | null;
  realtimeC4Count: number;
  alcobendasToChamartinCount: number;
  candidates: Candidate[];
};

const SELECTED_TRIP_KEY = "madrid-transit:selected-trip";

function readableStatus(status: string | null): string {
  if (status === "STOPPED_AT") return "Parado en estación";
  if (status === "IN_TRANSIT_TO") return "En marcha";
  if (status === "INCOMING_AT") return "Llegando";
  return "Estado desconocido";
}

function stopsLabel(value: number | null): string {
  if (value === null) return "Calculando…";
  if (value === 0) return "Estás en Chamartín";
  if (value === 1) return "Falta 1 estación";
  return `Faltan ${value} estaciones`;
}

export default function Home() {
  const [data, setData] = useState<C4AResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(SELECTED_TRIP_KEY);
    if (saved) setSelectedTripId(saved);
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/renfe/c4a", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData((await response.json()) as C4AResponse);
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

  function selectTrip(tripId: string) {
    setSelectedTripId(tripId);
    window.localStorage.setItem(SELECTED_TRIP_KEY, tripId);
  }

  function endTrip() {
    setSelectedTripId(null);
    window.localStorage.removeItem(SELECTED_TRIP_KEY);
  }

  const activeTrip = useMemo(
    () => data?.candidates.find((candidate) => candidate.trip.tripId === selectedTripId) ?? null,
    [data, selectedTripId],
  );

  const currentIndex = activeTrip?.progress.currentStop
    ? activeTrip.stops.findIndex(
        (stop) => stop.stopId === activeTrip.progress.currentStop?.stopId,
      )
    : -1;

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">MADRID TRANSIT LAB · v0.0.2</p>
        <h1>Alcobendas → Chamartín</h1>
        <p className="sub">
          Seguimiento real de C-4a. Datos oficiales primero, humo cero.
        </p>
      </header>

      {activeTrip ? (
        <section className="activeJourney" aria-live="polite">
          <div className="activeTopline">
            <span className="badge">VIAJE ACTIVO</span>
            <button className="ghostButton" onClick={endTrip}>
              Finalizar
            </button>
          </div>

          <p className="journeyLine">
            {activeTrip.trip.routeShortName ?? "C-4a"} ·{" "}
            {activeTrip.trip.tripHeadsign ?? "sentido Madrid"}
          </p>

          <strong className="bigStatus">
            {stopsLabel(activeTrip.progress.stopsToChamartin)}
          </strong>

          <div className="journeyFacts">
            <div>
              <span className="label">Ahora</span>
              <strong>
                {activeTrip.progress.currentStop?.stopName ?? "Ubicación por confirmar"}
              </strong>
            </div>
            <div>
              <span className="label">Siguiente</span>
              <strong>
                {activeTrip.progress.nextKnownStop?.stopName ?? "Calculando…"}
              </strong>
            </div>
            <div>
              <span className="label">Estado</span>
              <strong>{readableStatus(activeTrip.vehicle.currentStatus)}</strong>
            </div>
          </div>

          <ol className="route activeRoute">
            {activeTrip.stops.map((stop, index) => {
              const isPast = currentIndex >= 0 && index < currentIndex;
              const isCurrent = currentIndex === index;
              const isTarget = stop.stopName
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .includes("chamartin");

              return (
                <li
                  key={`${stop.stopId}-${stop.stopSequence}`}
                  className={[
                    isPast ? "past" : "",
                    isCurrent ? "current" : "",
                    isTarget ? "target" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="dot" aria-hidden="true" />
                  <span>{stop.stopName}</span>
                  {isCurrent ? <b> ← estás aquí</b> : null}
                  {isTarget ? <b> 🎯</b> : null}
                </li>
              );
            })}
          </ol>

          <div className="alertPreview">
            <span className="badge">P0-04 PREPARADO</span>
            <p>
              La próxima fase usará este progreso para avisarte a 2 y 1 estación de
              Chamartín. Todavía no activamos notificaciones hasta validar permisos y
              ejecución real.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="statusCard" aria-live="polite">
            <div>
              <span className="label">Feed Renfe</span>
              <strong>{loading ? "Actualizando…" : error ? "Error" : "Conectado"}</strong>
            </div>
            <div>
              <span className="label">C4 activos</span>
              <strong>{data?.realtimeC4Count ?? "—"}</strong>
            </div>
            <div>
              <span className="label">Hacia Chamartín</span>
              <strong>{data?.alcobendasToChamartinCount ?? "—"}</strong>
            </div>
            <button onClick={() => void refresh()} disabled={loading}>
              Actualizar
            </button>
          </section>

          {error ? (
            <p className="error">No hemos podido consultar el feed: {error}</p>
          ) : null}

          <section className="panel">
            <div className="sectionHeading">
              <div>
                <h2>Trenes compatibles ahora</h2>
                <p>
                  Solo mostramos C4 cuyo recorrido GTFS pasa por Alcobendas antes de
                  Chamartín.
                </p>
              </div>
              <span className="badge">P0-03</span>
            </div>

            {data?.candidates.length ? (
              <div className="candidateList">
                {data.candidates.map((candidate) => (
                  <article className="candidateCard" key={candidate.trip.tripId}>
                    <div>
                      <span className="label">C-4a detectada por recorrido</span>
                      <h3>
                        {candidate.progress.currentStop?.stopName ??
                          candidate.trip.tripHeadsign ??
                          "Tren C4"}
                      </h3>
                      <p>
                        {readableStatus(candidate.vehicle.currentStatus)} ·{" "}
                        {stopsLabel(candidate.progress.stopsToChamartin)}
                      </p>
                    </div>
                    <button
                      className="primaryButton"
                      onClick={() => selectTrip(candidate.trip.tripId)}
                    >
                      ▶ Voy en este tren
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="emptyState">
                <strong>No hay candidatos Alcobendas → Chamartín ahora mismo.</strong>
                <p>
                  Esto puede ser perfectamente normal según la hora. El feed seguirá
                  actualizándose cada 20 segundos.
                </p>
              </div>
            )}
          </section>
        </>
      )}

      <section className="nextCard">
        <span className="badge">SIGUIENTE</span>
        <h2>Alertas reales para bajar</h2>
        <p>
          Permiso de notificaciones + vibración + regla de 2 estaciones / 1 estación +
          protección contra avisos duplicados.
        </p>
      </section>
    </main>
  );
}
