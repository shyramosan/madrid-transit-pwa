import { NextRequest, NextResponse } from "next/server";
import {
  RENFE_VEHICLES_URL,
  fetchJson,
  looksLikeC4,
  normalizeVehicle,
  type RenfeFeed,
} from "@/lib/renfe";
import { resolveTrip, type ResolvedTrip, type ResolvedStop } from "@/lib/gtfs";

export const dynamic = "force-dynamic";

type Direction = "alcobendas-colmenar" | "colmenar-alcobendas" | "alcobendas-sol" | "sol-alcobendas" | "colmenar-sol" | "sol-colmenar";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findStopIndex(stops: ResolvedStop[], kind: "alcobendas" | "cantoblanco" | "colmenar" | "sol") {
  return stops.findIndex((stop) => {
    const name = normalize(stop.stopName);
    if (kind === "alcobendas") return name.includes("alcobendas");
    if (kind === "cantoblanco") return name.includes("cantoblanco");
    if (kind === "colmenar") return name.includes("colmenar viejo");
    return name === "sol" || name.includes("sol");
  });
}

function buildLeg(
  trip: ResolvedTrip,
  vehicle: ReturnType<typeof normalizeVehicle>,
  originKind: "alcobendas" | "cantoblanco" | "colmenar" | "sol",
  destinationKind: "alcobendas" | "cantoblanco" | "colmenar" | "sol",
  phase: 1 | 2,
) {
  const originIndex = findStopIndex(trip.stops, originKind);
  const destinationIndex = findStopIndex(trip.stops, destinationKind);

  if (originIndex < 0 || destinationIndex < 0 || originIndex >= destinationIndex) return null;

  const currentStopIndex = vehicle.stopId
    ? trip.stops.findIndex((stop) => stop.stopId === vehicle.stopId)
    : -1;

  if (currentStopIndex > destinationIndex) return null;

  const segment = trip.stops.slice(originIndex, destinationIndex + 1);
  const currentStop =
    currentStopIndex >= 0 ? trip.stops[currentStopIndex] : null;
  const nextKnownStop =
    currentStopIndex >= 0 && currentStopIndex + 1 < trip.stops.length
      ? trip.stops[currentStopIndex + 1]
      : null;

  const stopsToDestination =
    currentStopIndex >= 0 && currentStopIndex <= destinationIndex
      ? destinationIndex - currentStopIndex
      : null;

  return {
    phase,
    vehicle,
    trip: {
      tripId: trip.tripId,
      routeId: trip.routeId,
      routeShortName: trip.routeShortName,
      routeLongName: trip.routeLongName,
      tripHeadsign: trip.tripHeadsign,
      directionId: trip.directionId,
    },
    origin: trip.stops[originIndex],
    destination: trip.stops[destinationIndex],
    progress: {
      currentStop,
      nextKnownStop,
      stopsToDestination,
    },
    stops: segment,
  };
}

export async function GET(request: NextRequest) {
  const directionParam = request.nextUrl.searchParams.get("direction");
  const allowed: Direction[] = [
    "alcobendas-colmenar",
    "colmenar-alcobendas",
    "alcobendas-sol",
    "sol-alcobendas",
    "colmenar-sol",
    "sol-colmenar",
  ];
  const direction: Direction = allowed.includes(directionParam as Direction)
    ? (directionParam as Direction)
    : "alcobendas-colmenar";

  try {
    const feed = await fetchJson<RenfeFeed>(RENFE_VEHICLES_URL);
    const realtime = (feed.entity ?? [])
      .filter((entity) => entity.vehicle)
      .filter(looksLikeC4)
      .map(normalizeVehicle);

    const resolved = await Promise.all(
      realtime.map(async (vehicle) => ({
        vehicle,
        trip: vehicle.tripId ? await resolveTrip(vehicle.tripId) : null,
      })),
    );

    const leg1 = [];
    const leg2 = [];
    let requiresTransfer = false;
    let interchange: string | null = null;
    let labels: [string, string?] = [""];

    for (const { vehicle, trip } of resolved) {
      if (!trip) continue;

      if (direction === "alcobendas-colmenar") {
        requiresTransfer = true;
        interchange = "Cantoblanco Universidad";
        labels = ["Alcobendas → Cantoblanco", "Cantoblanco → Colmenar Viejo"];
        const first = buildLeg(trip, vehicle, "alcobendas", "cantoblanco", 1);
        const second = buildLeg(trip, vehicle, "cantoblanco", "colmenar", 2);
        if (first) leg1.push(first);
        if (second) leg2.push(second);
      } else if (direction === "colmenar-alcobendas") {
        requiresTransfer = true;
        interchange = "Cantoblanco Universidad";
        labels = ["Colmenar Viejo → Cantoblanco", "Cantoblanco → Alcobendas"];
        const first = buildLeg(trip, vehicle, "colmenar", "cantoblanco", 1);
        const second = buildLeg(trip, vehicle, "cantoblanco", "alcobendas", 2);
        if (first) leg1.push(first);
        if (second) leg2.push(second);
      } else {
        const config = {
          "alcobendas-sol": ["alcobendas", "sol", "Alcobendas → Sol"],
          "sol-alcobendas": ["sol", "alcobendas", "Sol → Alcobendas"],
          "colmenar-sol": ["colmenar", "sol", "Colmenar Viejo → Sol"],
          "sol-colmenar": ["sol", "colmenar", "Sol → Colmenar Viejo"],
        }[direction] as [
          "alcobendas" | "colmenar" | "sol",
          "alcobendas" | "colmenar" | "sol",
          string,
        ];
        labels = [config[2]];
        const direct = buildLeg(trip, vehicle, config[0], config[1], 1);
        if (direct) leg1.push(direct);
      }
    }

    return NextResponse.json({
      source: {
        realtime: "Renfe Open Data · vehicle_positions.json",
        static: "Renfe GTFS · fomento_transit.zip",
      },
      feedTimestamp: feed.header?.timestamp ?? null,
      direction,
      requiresTransfer,
      interchange,
      realtimeC4Count: realtime.length,
      corridor: [
        "Alcobendas-S.S. de los Reyes",
        "Valdelasfuentes",
        "Universidad P. Comillas",
        "Cantoblanco Universidad",
        "Fuencarral",
        "Chamartín-Clara Campoamor",
        "Nuevos Ministerios",
        "Sol",
      ],
      legs: [
        { phase: 1, label: labels[0], candidates: leg1 },
        ...(requiresTransfer
          ? [{ phase: 2, label: labels[1], candidates: leg2 }]
          : []),
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "ALCOBENDAS_COLMENAR_RESOLUTION_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
