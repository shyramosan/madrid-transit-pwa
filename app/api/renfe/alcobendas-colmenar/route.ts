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

type Direction = "alcobendas-colmenar" | "colmenar-alcobendas";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findStopIndex(stops: ResolvedStop[], kind: "alcobendas" | "cantoblanco" | "colmenar") {
  return stops.findIndex((stop) => {
    const name = normalize(stop.stopName);
    if (kind === "alcobendas") return name.includes("alcobendas");
    if (kind === "cantoblanco") return name.includes("cantoblanco");
    return name.includes("colmenar viejo");
  });
}

function buildLeg(
  trip: ResolvedTrip,
  vehicle: ReturnType<typeof normalizeVehicle>,
  originKind: "alcobendas" | "cantoblanco" | "colmenar",
  destinationKind: "alcobendas" | "cantoblanco" | "colmenar",
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
  const direction: Direction =
    directionParam === "colmenar-alcobendas"
      ? "colmenar-alcobendas"
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

    for (const { vehicle, trip } of resolved) {
      if (!trip) continue;

      if (direction === "alcobendas-colmenar") {
        const first = buildLeg(trip, vehicle, "alcobendas", "cantoblanco", 1);
        const second = buildLeg(trip, vehicle, "cantoblanco", "colmenar", 2);
        if (first) leg1.push(first);
        if (second) leg2.push(second);
      } else {
        const first = buildLeg(trip, vehicle, "colmenar", "cantoblanco", 1);
        const second = buildLeg(trip, vehicle, "cantoblanco", "alcobendas", 2);
        if (first) leg1.push(first);
        if (second) leg2.push(second);
      }
    }

    return NextResponse.json({
      source: {
        realtime: "Renfe Open Data · vehicle_positions.json",
        static: "Renfe GTFS · fomento_transit.zip",
      },
      feedTimestamp: feed.header?.timestamp ?? null,
      direction,
      requiresTransfer: true,
      interchange: "Cantoblanco Universidad",
      realtimeC4Count: realtime.length,
      legs: [
        {
          phase: 1,
          label:
            direction === "alcobendas-colmenar"
              ? "Alcobendas → Cantoblanco"
              : "Colmenar Viejo → Cantoblanco",
          candidates: leg1,
        },
        {
          phase: 2,
          label:
            direction === "alcobendas-colmenar"
              ? "Cantoblanco → Colmenar Viejo"
              : "Cantoblanco → Alcobendas",
          candidates: leg2,
        },
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
