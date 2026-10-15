"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type NotificationState = "unsupported" | "default" | "granted" | "denied";

const SELECTED_TRIP_KEY = "madrid-transit:selected-trip";
const ALERTS_KEY = "madrid-transit:sent-alerts";

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

function getSentAlerts(): Set<string> {
  try {
    const raw = window.localStorage.getItem(ALERTS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function rememberAlert(key: string) {
  const sent = getSentAlerts();
  sent.add(key);
  window.localStorage.setItem(ALERTS_KEY, JSON.stringify([...sent]));
}

async function showSystemNotification(title: string, body: string) {
  if (!("serviceWorker" in navigator)) return false;

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    body,
    tag: "madrid-transit-journey",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: "/" },
  });

  return true;
}

export default function Home() {
  const [data, setData] = useState<C4AResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [notificationState, setNotificationState] =
    useState<NotificationState>("default");
  const [inlineAlert, setInlineAlert] = useState<string | null>(null);
  const previousStopsRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(SELECTED_TRIP_KEY);
    if (saved) setSelectedTripId(saved);

    if (!("Notification" in window)) {
      setNotificationState("unsupported");
    } else {
      setNotificationState(Notification.permission);
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
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
    previousStopsRef.current = null;
    window.localStorage.setItem(SELECTED_TRIP_KEY, tripId);
  }

  function endTrip() {
    setSelectedTripId(null);
    setInlineAlert(null);
    previousStopsRef.current = null;
    window.localStorage.removeItem(SELECTED_TRIP_KEY);
  }

  async function requestNotifications() {
    if (!("Notification" in window)) {
      setNotificationState("unsupported");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationState(permission);
  }

  const activeTrip = useMemo(
    () =>
      data?.candidates.find(
        (candidate) => candidate.trip.tripId === selectedTripId,
      ) ?? null,
    [data, selectedTripId],
  );

  const currentIndex = activeTrip?.progress.currentStop
    ? activeTrip.stops.findIndex(
        (stop) => stop.stopId === activeTrip.progress.currentStop?.stopId,
      )
    : -1;

  useEffect(() => {
    const remaining = activeTrip?.progress.stopsToChamartin;
    const tripId = activeTrip?.trip.tripId;

    if (remaining === null || remaining === undefined || !tripId) return;

    const previous = previousStopsRef.current;
    previousStopsRef.current = remaining;

    if (remaining !== 2 && remaining !== 1) return;
    if (previous !== null && previous < remaining) return;

    const alertKey = `${tripId}:${remaining}`;
    if (getSentAlerts().has(alertKey)) return;

    const message =
      remaining === 2
        ? "Faltan 2 estaciones para Chamartín. Ve preparándote."
        : "La siguiente es Chamartín. Prepárate para bajar.";

    rememberAlert(alertKey);
    setInlineAlert(message);

    if ("vibrate" in navigator) {
      navigator.vibrate(remaining === 1 ? [250, 120, 250] : [180, 100, 180]);
    }

    if (notificationState === "granted") {
      void showSystemNotification(
        remaining === 1 ? "🚆 Próxima parada: la tuya" : "🚆 Chamartín se acerca",
        message,
      );
    }
  }, [activeTrip, notificationState]);

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">MADRID TRANSIT LAB · v0.0.3</p>
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

          {inlineAlert ? (
            <div className="liveAlert" role="alert">
              <strong>{inlineAlert}</strong>
              <button
                className="ghostButton"
                onClick={() => setInlineAlert(null)}
                aria-label="Cerrar aviso"
              >
                Cerrar
              </button>
            </div>
          ) : null}

          <p className="journeyLine">
            {activeTrip.trip.routeShortName ?? "C-4a"} ·{" "}
            {activeTrip.trip.tripHeadsign ?? "sentido Madrid"}
          </p>

          <strong className="bigStatus">
            {stopsLabel(activeTrip.progress.stopsToChamartin)}
          </strong>

          <div className="notificationCard">
            <div>
              <span className="label">Avisos para bajar</span>
              <strong>
                {notificationState === "granted"
                  ? "Notificaciones activadas"
                  : notificationState === "denied"
                    ? "Notificaciones bloqueadas"
                    : notificationState === "unsupported"
                      ? "No disponibles en este navegador"
                      : "Pendientes de activar"}
              </strong>
              <p>
                Aunque no haya permiso, mantendremos el aviso visible y la vibración
                si el dispositivo la permite.
              </p>
            </div>
            {notificationState === "default" ? (
              <button className="primaryButton" onClick={() => void requestNotifications()}>
                🔔 Activar avisos
              </button>
            ) : null}
          </div>

          <div className="journeyFacts">
            <div>
              <span className="label">Ahora</span>
              <strong>
                {activeTrip.progress.currentStop?.stopName ??
                  "Ubicación por confirmar"}
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
            <span className="badge">P0-04</span>
            <p>
              Avisaremos una sola vez a 2 estaciones y otra a 1 estación. Las claves
              de aviso se guardan por viaje para evitar el festival de vibraciones cada
              20 segundos.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="statusCard" aria-live="polite">
            <div>
              <span className="label">Feed Renfe</span>
              <strong>
                {loading ? "Actualizando…" : error ? "Error" : "Conectado"}
              </strong>
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
                <strong>
                  No hay candidatos Alcobendas → Chamartín ahora mismo.
                </strong>
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
        <h2>Validación móvil + GPS de respaldo</h2>
        <p>
          Probar permisos en Android/PWA y usar la ubicación del móvil para no depender
          únicamente del stopId de Renfe.
        </p>
      </section>
    </main>
  );
}
