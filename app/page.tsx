"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Direction = "alcobendas-colmenar" | "colmenar-alcobendas" | "alcobendas-sol" | "sol-alcobendas" | "colmenar-sol" | "sol-colmenar";

type Stop = {
  stopId: string;
  stopName: string;
  stopSequence: number;
  arrivalTime: string | null;
  departureTime: string | null;
};

type Candidate = {
  phase: 1 | 2;
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
  origin: Stop;
  destination: Stop;
  progress: {
    currentStop: Stop | null;
    nextKnownStop: Stop | null;
    stopsToDestination: number | null;
  };
  stops: Stop[];
};

type JourneyResponse = {
  feedTimestamp: string | null;
  direction: Direction;
  requiresTransfer: boolean;
  interchange: string | null;
  realtimeC4Count: number;
  corridor: string[];
  legs: Array<{
    phase: 1 | 2;
    label: string;
    candidates: Candidate[];
  }>;
};

type ActiveSelection = {
  tripId: string;
  phase: 1 | 2;
  destinationName: string;
};

type NotificationState = "unsupported" | "default" | "granted" | "denied";

const ACTIVE_KEY = "madrid-transit:active-selection";
const ALERTS_KEY = "madrid-transit:sent-alerts";
const DIRECTION_KEY = "madrid-transit:direction";

function readableStatus(status: string | null): string {
  if (status === "STOPPED_AT") return "Parado en estación";
  if (status === "IN_TRANSIT_TO") return "En marcha";
  if (status === "INCOMING_AT") return "Llegando";
  return "Estado desconocido";
}

function remainingLabel(value: number | null, destination: string): string {
  if (value === null) return "Calculando…";
  if (value === 0) return `Estás en ${destination}`;
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
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    body,
    tag: "madrid-transit-journey",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: "/" },
  });
}

export default function Home() {
  const [direction, setDirection] = useState<Direction>("alcobendas-colmenar");
  const [data, setData] = useState<JourneyResponse | null>(null);
  const [active, setActive] = useState<ActiveSelection | null>(null);
  const [notificationState, setNotificationState] =
    useState<NotificationState>("default");
  const [inlineAlert, setInlineAlert] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previousStopsRef = useRef<number | null>(null);

  useEffect(() => {
    const savedDirection = window.localStorage.getItem(DIRECTION_KEY) as Direction | null;
    const allowedDirections: Direction[] = [
      "alcobendas-colmenar",
      "colmenar-alcobendas",
      "alcobendas-sol",
      "sol-alcobendas",
      "colmenar-sol",
      "sol-colmenar",
    ];
    if (savedDirection && allowedDirections.includes(savedDirection)) {
      setDirection(savedDirection);
    }

    try {
      const savedActive = window.localStorage.getItem(ACTIVE_KEY);
      if (savedActive) setActive(JSON.parse(savedActive) as ActiveSelection);
    } catch {}

    if (!("Notification" in window)) setNotificationState("unsupported");
    else setNotificationState(Notification.permission);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  async function refresh(currentDirection = direction) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/renfe/alcobendas-colmenar?direction=${currentDirection}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData((await response.json()) as JourneyResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer Renfe");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(direction);
    const timer = window.setInterval(() => void refresh(direction), 20_000);
    return () => window.clearInterval(timer);
  }, [direction]);

  function changeDirection(next: Direction) {
    setDirection(next);
    setActive(null);
    setInlineAlert(null);
    previousStopsRef.current = null;
    window.localStorage.setItem(DIRECTION_KEY, next);
    window.localStorage.removeItem(ACTIVE_KEY);
  }

  function selectTrain(candidate: Candidate) {
    const next: ActiveSelection = {
      tripId: candidate.trip.tripId,
      phase: candidate.phase,
      destinationName: candidate.destination.stopName,
    };
    setActive(next);
    setInlineAlert(null);
    previousStopsRef.current = null;
    window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(next));
  }

  function endTrip() {
    setActive(null);
    setInlineAlert(null);
    previousStopsRef.current = null;
    window.localStorage.removeItem(ACTIVE_KEY);
  }

  async function requestNotifications() {
    if (!("Notification" in window)) {
      setNotificationState("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationState(permission);
  }

  const allCandidates = useMemo(
    () => data?.legs.flatMap((leg) => leg.candidates) ?? [],
    [data],
  );

  const activeTrip = useMemo(
    () => allCandidates.find((candidate) => candidate.trip.tripId === active?.tripId) ?? null,
    [allCandidates, active],
  );

  useEffect(() => {
    const remaining = activeTrip?.progress.stopsToDestination;
    const tripId = activeTrip?.trip.tripId;
    const destination = activeTrip?.destination.stopName;

    if (remaining === null || remaining === undefined || !tripId || !destination) return;

    const previous = previousStopsRef.current;
    previousStopsRef.current = remaining;

    if (remaining !== 2 && remaining !== 1) return;
    if (previous !== null && previous < remaining) return;

    const alertKey = `${tripId}:${destination}:${remaining}`;
    if (getSentAlerts().has(alertKey)) return;

    const isTransfer = Boolean(data?.requiresTransfer && activeTrip.phase === 1);
    const message =
      remaining === 2
        ? `Faltan 2 estaciones para ${destination}.`
        : isTransfer
          ? `La siguiente es ${destination}. Aquí haces transbordo.`
          : `La siguiente es ${destination}. Prepárate para bajar.`;

    rememberAlert(alertKey);
    setInlineAlert(message);

    if ("vibrate" in navigator) {
      navigator.vibrate(remaining === 1 ? [250, 120, 250] : [180, 100, 180]);
    }

    if (notificationState === "granted") {
      void showSystemNotification(
        remaining === 1
          ? isTransfer
            ? "🚆 Próxima parada: transbordo"
            : "🚆 Próxima parada: la tuya"
          : "🚆 Se acerca tu próxima acción",
        message,
      );
    }
  }, [activeTrip, notificationState]);

  const title = {
    "alcobendas-colmenar": "Alcobendas → Colmenar Viejo",
    "colmenar-alcobendas": "Colmenar Viejo → Alcobendas",
    "alcobendas-sol": "Alcobendas → Sol",
    "sol-alcobendas": "Sol → Alcobendas",
    "colmenar-sol": "Colmenar Viejo → Sol",
    "sol-colmenar": "Sol → Colmenar Viejo",
  }[direction];

  return (
    <main className="shell">
      <nav className="modeNav" aria-label="Modo de transporte">\n        <a href="/" className="active">🚆 Cercanías</a>\n        <a href="/bus">🚌 Bus</a>\n      </nav>\n\n      <header className="hero heroWithMascot">
        <div>
          <p className="eyebrow">MADRID TRANSIT LAB · v0.0.4</p>
          <h1>{title}</h1>
          <p className="sub">
            Ruta C-4 con transbordo inteligente en Cantoblanco Universidad.
          </p>
        </div>
        <img
          className="mascot"
          src="/mascot.webp"
          alt=""
          width="128"
          height="128"
          aria-hidden="true"
        />
      </header>

      <div className="directionSwitch routePicker" role="group" aria-label="Trayecto">
        {([
          ["alcobendas-sol", "Alcobendas → Sol"],
          ["sol-alcobendas", "Sol → Alcobendas"],
          ["colmenar-sol", "Colmenar → Sol"],
          ["sol-colmenar", "Sol → Colmenar"],
          ["alcobendas-colmenar", "Alcobendas → Colmenar"],
          ["colmenar-alcobendas", "Colmenar → Alcobendas"],
        ] as Array<[Direction, string]>).map(([value, label]) => (
          <button
            key={value}
            className={direction === value ? "active" : ""}
            onClick={() => changeDirection(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="transferCard">
        <span className="badge">
          {data?.requiresTransfer ? "1 TRANSBORDO" : "DIRECTO"}
        </span>
        <strong>
          {data?.requiresTransfer
            ? data.interchange ?? "Cantoblanco Universidad"
            : "C-4 · tronco central"}
        </strong>
        <p>
          {data?.requiresTransfer
            ? "C-4a y C-4b se separan en Cantoblanco. La app te avisará para cambiar de tren."
            : "Fuencarral → Chamartín → Nuevos Ministerios → Sol, sin cambiar de tren."}
        </p>
        <div className="corridorPills" aria-label="Estaciones cubiertas">
          {(data?.corridor ?? [
            "Alcobendas-S.S. de los Reyes",
            "Valdelasfuentes",
            "Universidad P. Comillas",
            "Cantoblanco Universidad",
            "Fuencarral",
            "Chamartín-Clara Campoamor",
            "Nuevos Ministerios",
            "Sol",
          ]).map((station) => (
            <span
              key={station}
              className={
                station.includes("Nuevos Ministerios") || station === "Sol"
                  ? "stationPill featured"
                  : "stationPill"
              }
            >
              {station}
            </span>
          ))}
        </div>
      </section>

      {activeTrip ? (
        <section className="activeJourney" aria-live="polite">
          <div className="activeTopline">
            <span className="badge">
              {activeTrip.phase === 1 ? "TRAMO 1 · TRANSBORDO" : "TRAMO 2 · DESTINO"}
            </span>
            <button className="ghostButton" onClick={endTrip}>Finalizar tramo</button>
          </div>

          {inlineAlert ? (
            <div className="liveAlert" role="alert">
              <strong>{inlineAlert}</strong>
              <button className="ghostButton" onClick={() => setInlineAlert(null)}>
                Cerrar
              </button>
            </div>
          ) : null}

          <p className="journeyLine">
            {activeTrip.origin.stopName} → {activeTrip.destination.stopName}
          </p>

          <strong className="bigStatus">
            {remainingLabel(
              activeTrip.progress.stopsToDestination,
              activeTrip.destination.stopName,
            )}
          </strong>

          <div className="notificationCard">
            <div>
              <span className="label">Avisos</span>
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
{data?.requiresTransfer
                  ? "Aviso a 2 estaciones y a 1. En el primer tramo te recordaremos que toca transbordo."
                  : "Aviso a 2 estaciones y a 1 para tu destino, sin transbordo."}
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
              <strong>{activeTrip.progress.currentStop?.stopName ?? "Ubicación por confirmar"}</strong>
            </div>
            <div>
              <span className="label">Siguiente</span>
              <strong>{activeTrip.progress.nextKnownStop?.stopName ?? "Calculando…"}</strong>
            </div>
            <div>
              <span className="label">Estado</span>
              <strong>{readableStatus(activeTrip.vehicle.currentStatus)}</strong>
            </div>
          </div>

          <ol className="route activeRoute">
            {activeTrip.stops.map((stop) => {
              const isCurrent = stop.stopId === activeTrip.progress.currentStop?.stopId;
              const isTarget = stop.stopId === activeTrip.destination.stopId;
              return (
                <li
                  key={`${stop.stopId}-${stop.stopSequence}`}
                  className={[isCurrent ? "current" : "", isTarget ? "target" : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="dot" aria-hidden="true" />
                  <span>{stop.stopName}</span>
                  {isCurrent ? <b> ← estás aquí</b> : null}
                  {isTarget ? <b>{activeTrip.phase === 1 ? " 🔁" : " 🎯"}</b> : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : (
        <>
          <section className="statusCard">
            <div>
              <span className="label">Feed Renfe</span>
              <strong>{loading ? "Actualizando…" : error ? "Error" : "Conectado"}</strong>
            </div>
            <div>
              <span className="label">C4 activos</span>
              <strong>{data?.realtimeC4Count ?? "—"}</strong>
            </div>
            <div>
              <span className="label">Transbordo</span>
              <strong>Cantoblanco</strong>
            </div>
            <button onClick={() => void refresh(direction)} disabled={loading}>Actualizar</button>
          </section>

          {error ? <p className="error">{error}</p> : null}

          {(data?.legs ?? []).map((leg) => (
            <section className="panel" key={leg.phase}>
              <div className="sectionHeading">
                <div>
                  <h2>{leg.phase === 1 ? "1. Primer tren" : "2. Después del transbordo"}</h2>
                  <p>{leg.label}</p>
                </div>
                <span className="badge">{leg.candidates.length} activos</span>
              </div>

              {leg.candidates.length ? (
                <div className="candidateList">
                  {leg.candidates.map((candidate) => (
                    <article className="candidateCard" key={candidate.trip.tripId}>
                      <div>
                        <span className="label">
                          {candidate.trip.tripHeadsign ?? candidate.trip.routeShortName ?? "C-4"}
                        </span>
                        <h3>
                          {candidate.progress.currentStop?.stopName ??
                            `Hacia ${candidate.destination.stopName}`}
                        </h3>
                        <p>
                          {readableStatus(candidate.vehicle.currentStatus)} ·{" "}
                          {remainingLabel(
                            candidate.progress.stopsToDestination,
                            candidate.destination.stopName,
                          )}
                        </p>
                      </div>
                      <button
                        className="primaryButton"
                        onClick={() => selectTrain(candidate)}
                      >
                        ▶ Voy en este tren
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="emptyState">
                  <strong>No vemos un tren de este tramo ahora mismo.</strong>
                  <p>El feed se refresca cada 20 segundos.</p>
                </div>
              )}
            </section>
          ))}
        </>
      )}

      <section className="nextCard">
        <span className="badge">SIGUIENTE</span>
        <h2>Elegir automáticamente el mejor transbordo</h2>
        <p>
          El siguiente paso será cruzar horarios/ETA de ambos tramos para decirte no solo qué tren tomar,
          sino cuál te deja menos espera en Cantoblanco.
        </p>
      </section>
    </main>
  );
}
