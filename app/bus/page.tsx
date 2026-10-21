"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CatalogLine = {
  line: string;
  name: string;
  network: "urban" | "interurban";
  municipalities: string[];
};

type Stop = {
  stationCode: string;
  line: string;
  direction: string | null;
  order: number;
  name: string;
  address: string;
  municipality: string;
  lat: number | null;
  lon: number | null;
};

type IkeaPlan = {
  request: {
    origin: string;
    destination: string;
    userLocationUsed: boolean;
  };
  recommendedLine: string;
  routeName: string;
  walkingFinalMinutes: number;
  realtime: {
    status: string;
    message: string;
  };
  best: null | {
    direction: string;
    boarding: Stop | null;
    alighting: Stop | null;
    boardingWalkMeters: number | null;
    estimatedRideMinutes: number | null;
    stops: Stop[];
  };
  shapes: Array<Array<[number, number]>>;
};

type UserPoint = {
  lat: number;
  lon: number;
  accuracy: number;
};

function walkMinutes(meters: number | null) {
  if (meters === null) return null;
  return Math.max(1, Math.round(meters / 80));
}

function RouteMap({
  shapes,
  boarding,
  alighting,
  user,
}: {
  shapes: IkeaPlan["shapes"];
  boarding: Stop | null | undefined;
  alighting: Stop | null | undefined;
  user: UserPoint | null;
}) {
  const points = shapes.flat();
  if (!points.length) {
    return (
      <div className="busMapEmpty">
        <strong>Preparando geometría CRTM…</strong>
        <span>El mapa aparecerá cuando cargue el recorrido oficial de la línea.</span>
      </div>
    );
  }

  const extras: Array<[number, number]> = [];
  if (boarding?.lon !== null && boarding?.lat !== null && boarding?.lon !== undefined && boarding?.lat !== undefined) {
    extras.push([boarding.lon, boarding.lat]);
  }
  if (alighting?.lon !== null && alighting?.lat !== null && alighting?.lon !== undefined && alighting?.lat !== undefined) {
    extras.push([alighting.lon, alighting.lat]);
  }
  if (user) extras.push([user.lon, user.lat]);

  const all = [...points, ...extras];
  const lons = all.map((point) => point[0]);
  const lats = all.map((point) => point[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const spanLon = Math.max(maxLon - minLon, 0.001);
  const spanLat = Math.max(maxLat - minLat, 0.001);
  const width = 720;
  const height = 360;
  const pad = 28;

  const project = ([lon, lat]: [number, number]) => {
    const x = pad + ((lon - minLon) / spanLon) * (width - pad * 2);
    const y = height - pad - ((lat - minLat) / spanLat) * (height - pad * 2);
    return [x, y] as const;
  };

  return (
    <div className="busMapWrap">
      <svg
        className="busMap"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Recorrido geográfico de la línea 4 con origen y destino"
      >
        <rect width={width} height={height} rx="20" className="busMapBg" />
        {shapes.map((path, index) => {
          const d = path
            .map((point, pointIndex) => {
              const [x, y] = project(point);
              return `${pointIndex === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(" ");
          return <path key={index} d={d} className="busShape" />;
        })}

        {boarding?.lon !== null && boarding?.lat !== null && boarding?.lon !== undefined && boarding?.lat !== undefined ? (() => {
          const [x, y] = project([boarding.lon, boarding.lat]);
          return (
            <g>
              <circle cx={x} cy={y} r="9" className="mapBoarding" />
              <text x={x + 13} y={y - 10} className="mapLabel">
                Subes
              </text>
            </g>
          );
        })() : null}

        {alighting?.lon !== null && alighting?.lat !== null && alighting?.lon !== undefined && alighting?.lat !== undefined ? (() => {
          const [x, y] = project([alighting.lon, alighting.lat]);
          return (
            <g>
              <circle cx={x} cy={y} r="9" className="mapAlighting" />
              <text x={x + 13} y={y + 22} className="mapLabel">
                Bajas
              </text>
            </g>
          );
        })() : null}

        {user ? (() => {
          const [x, y] = project([user.lon, user.lat]);
          return (
            <g>
              <circle cx={x} cy={y} r="15" className="mapUserHalo" />
              <circle cx={x} cy={y} r="6" className="mapUser" />
            </g>
          );
        })() : null}
      </svg>
      <div className="mapLegend">
        <span>● Tú</span>
        <span>● Subida</span>
        <span>● Bajada</span>
        <span>Ruta: CRTM oficial</span>
      </div>
    </div>
  );
}

export default function BusPage() {
  const [catalog, setCatalog] = useState<CatalogLine[]>([]);
  const [plan, setPlan] = useState<IkeaPlan | null>(null);
  const [user, setUser] = useState<UserPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [network, setNetwork] = useState<"all" | "urban" | "interurban">("all");
  const [query, setQuery] = useState("");
  const [targetTime, setTargetTime] = useState("09:00");
  const watchRef = useRef<number | null>(null);

  async function loadPlan(point?: UserPoint | null) {
    const suffix = point
      ? `?lat=${encodeURIComponent(point.lat)}&lon=${encodeURIComponent(point.lon)}`
      : "";
    const response = await fetch(`/api/bus/ikea${suffix}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    setPlan((await response.json()) as IkeaPlan);
  }

  useEffect(() => {
    void Promise.all([
      fetch("/api/bus/catalog", { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => setCatalog(data.lines ?? [])),
      loadPlan(null),
    ]);
  }, []);

  function startLocation() {
    if (!("geolocation" in navigator)) {
      setLocationError("Este navegador no ofrece ubicación.");
      return;
    }

    setLocating(true);
    setLocationError(null);

    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setUser(point);
        setLocating(false);
        void loadPlan(point);
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Ubicación bloqueada. Puedes permitirla solo mientras usas la app."
            : "No hemos podido obtener tu ubicación.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 12_000 },
    );
  }

  function stopLocation() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setUser(null);
  }

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  const visibleLines = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.filter((item) => {
      if (network !== "all" && item.network !== network) return false;
      if (!needle) return true;
      return (
        item.line.toLowerCase().includes(needle) ||
        item.name.toLowerCase().includes(needle) ||
        item.municipalities.join(" ").toLowerCase().includes(needle)
      );
    });
  }, [catalog, network, query]);

  const best = plan?.best ?? null;
  const walkToStop = walkMinutes(best?.boardingWalkMeters ?? null);
  const ride = best?.estimatedRideMinutes ?? null;
  const knownTotal =
    walkToStop !== null && ride !== null
      ? walkToStop + ride + (plan?.walkingFinalMinutes ?? 0)
      : null;

  return (
    <main className="shell">
      <nav className="modeNav" aria-label="Modo de transporte">
        <a href="/">🚆 Cercanías</a>
        <a href="/bus" className="active">🚌 Bus</a>
      </nav>

      <header className="hero heroWithMascot">
        <div>
          <p className="eyebrow">MADRID TRANSIT LAB · BUS BETA</p>
          <h1>Autobuses Alcobendas + Sanse</h1>
          <p className="sub">
            Paradas y recorridos CRTM oficiales, GPS del móvil y viaje en vivo.
          </p>
        </div>
        <img className="mascot" src="/mascot.webp" alt="" width="128" height="128" />
      </header>

      <section className="panel">
        <div className="sectionHeading">
          <div>
            <h2>Avenida de Colmenar Viejo → IKEA</h2>
            <p>Caso patrón para construir el viaje puerta a puerta.</p>
          </div>
          <span className="badge">L4 · MOSCATELARES</span>
        </div>

        <div className="busPlannerGrid">
          <label>
            <span className="label">Quiero estar allí sobre</span>
            <input
              type="time"
              value={targetTime}
              onChange={(event) => setTargetTime(event.target.value)}
            />
          </label>
          <div>
            <span className="label">Origen</span>
            <strong>Avenida de Colmenar Viejo</strong>
          </div>
          <div>
            <span className="label">Destino</span>
            <strong>IKEA · MegaPark</strong>
          </div>
        </div>

        <div className="locationActions">
          {!user ? (
            <button className="primaryButton" onClick={startLocation} disabled={locating}>
              {locating ? "Localizando…" : "📍 Usar mi ubicación"}
            </button>
          ) : (
            <button className="ghostButton" onClick={stopLocation}>Dejar de usar GPS</button>
          )}
          <span className="muted">
            {user
              ? `GPS activo · precisión ±${Math.round(user.accuracy)} m`
              : "Sin GPS elegimos una parada genérica de Av. de Colmenar Viejo."}
          </span>
        </div>

        {locationError ? <p className="error">{locationError}</p> : null}
      </section>

      <section className="activeJourney">
        <div className="activeTopline">
          <span className="badge">VIAJE EN VIVO</span>
          <span className="realtimePending">🟡 Bus realtime: adaptador pendiente</span>
        </div>

        <RouteMap
          shapes={plan?.shapes ?? []}
          boarding={best?.boarding}
          alighting={best?.alighting}
          user={user}
        />

        <div className="journeyFacts busFacts">
          <div>
            <span className="label">🚶 Hasta la parada</span>
            <strong>
              {best?.boardingWalkMeters !== null && best?.boardingWalkMeters !== undefined
                ? `${best.boardingWalkMeters} m · ~${walkToStop} min`
                : "Activa GPS para calcularlo"}
            </strong>
          </div>
          <div>
            <span className="label">🚌 Autobús</span>
            <strong>L4 · {ride !== null ? `~${ride} min` : "duración por validar"}</strong>
          </div>
          <div>
            <span className="label">🚶 IKEA</span>
            <strong>~{plan?.walkingFinalMinutes ?? 14} min andando</strong>
          </div>
        </div>

        <div className="liveSteps">
          <article>
            <span className="stepIcon">1</span>
            <div>
              <strong>Ve a la parada</strong>
              <p>{best?.boarding?.address || best?.boarding?.name || "Avenida de Colmenar Viejo"}</p>
            </div>
          </article>
          <article>
            <span className="stepIcon">2</span>
            <div>
              <strong>Coge la L4 hacia Moscatelares</strong>
              <p>
                {plan?.realtime.status === "official_feed_pending"
                  ? "Mostraremos aquí «llega en X min» cuando conectemos el realtime público."
                  : "Tiempo real conectado."}
              </p>
            </div>
          </article>
          <article>
            <span className="stepIcon">3</span>
            <div>
              <strong>Baja en Av. Matapiñonera</strong>
              <p>{best?.alighting?.address || best?.alighting?.name || "Zona Moscatelares"}</p>
            </div>
          </article>
          <article>
            <span className="stepIcon">4</span>
            <div>
              <strong>Camina hasta IKEA</strong>
              <p>Referencia oficial IKEA: unos {plan?.walkingFinalMinutes ?? 14} min desde Av. Matapiñonera.</p>
            </div>
          </article>
        </div>

        <div className="liveSummary">
          <strong>
            {knownTotal !== null
              ? `Tiempo base conocido: ~${knownTotal} min + espera del bus`
              : "Calculando tiempos del trayecto…"}
          </strong>
          <span>
            Objetivo {targetTime}. En cuanto conectemos ETA real calcularemos automáticamente «sal de casa a las…».
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHeading">
          <div>
            <h2>Todas las líneas de Alcobendas y Sanse</h2>
            <p>Catálogo unificado urbano + interurbano para el Bus Core.</p>
          </div>
          <span className="badge">{catalog.length} líneas</span>
        </div>

        <div className="busFilters">
          <input
            type="search"
            placeholder="Buscar línea o destino…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="filterButtons">
            {(["all", "urban", "interurban"] as const).map((value) => (
              <button
                key={value}
                className={network === value ? "active" : ""}
                onClick={() => setNetwork(value)}
              >
                {value === "all" ? "Todas" : value === "urban" ? "Urbanas" : "Interurbanas"}
              </button>
            ))}
          </div>
        </div>

        <div className="busLineGrid">
          {visibleLines.map((item) => (
            <article key={item.line} className="busLineCard">
              <span className="busLineNumber">{item.line}</span>
              <div>
                <strong>{item.name}</strong>
                <p>{item.municipalities.join(" · ")}</p>
              </div>
              <span className="miniBadge">{item.network === "urban" ? "urbana" : "interurbana"}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="nextCard">
        <span className="badge">SIGUIENTE BLOQUE</span>
        <h2>Posición real del 🚌 + ETA</h2>
        <p>
          La geometría, paradas y GPS del usuario ya tienen sitio en el motor. Falta conectar el canal SAE/realtime de CRTM para mover el autobús y calcular espera/retraso de forma oficial.
        </p>
      </section>
    </main>
  );
}
