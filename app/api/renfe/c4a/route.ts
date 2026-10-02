import { NextResponse } from "next/server";
import {
  RENFE_VEHICLES_URL,
  fetchJson,
  looksLikeC4,
  normalizeVehicle,
  type RenfeFeed,
} from "@/lib/renfe";
import { resolveTrip } from "@/lib/gtfs";

export const dynamic = "force-dynamic";

export async function GET() {
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

    const candidates = resolved
      .filter(({ trip }) => trip?.corridor.matchesPattern)
      .map(({ vehicle, trip }) => {
        if (!trip) return null;

        const currentStopIndex = vehicle.stopId
          ? trip.stops.findIndex((stop) => stop.stopId === vehicle.stopId)
          : -1;
        const chamartinIndex = trip.stops.findIndex((stop) =>
          stop.stopName
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .includes("chamartin"),
        );

        return {
          vehicle,
          trip: {
            tripId: trip.tripId,
            routeId: trip.routeId,
            routeShortName: trip.routeShortName,
            routeLongName: trip.routeLongName,
            tripHeadsign: trip.tripHeadsign,
            directionId: trip.directionId,
          },
          progress: {
            currentStop:
              currentStopIndex >= 0 ? trip.stops[currentStopIndex] : null,
            nextKnownStop:
              currentStopIndex >= 0
                ? trip.stops[Math.min(currentStopIndex + 1, trip.stops.length - 1)]
                : null,
            chamartin: chamartinIndex >= 0 ? trip.stops[chamartinIndex] : null,
            stopsToChamartin:
              currentStopIndex >= 0 && chamartinIndex >= currentStopIndex
                ? chamartinIndex - currentStopIndex
                : null,
          },
          stops: trip.stops,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      source: {
        realtime: "Renfe Open Data · vehicle_positions.json",
        static: "Renfe GTFS · fomento_transit.zip",
      },
      feedTimestamp: feed.header?.timestamp ?? null,
      realtimeC4Count: realtime.length,
      alcobendasToChamartinCount: candidates.length,
      candidates,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "C4A_RESOLUTION_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
