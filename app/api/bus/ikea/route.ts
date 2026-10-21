import { NextRequest, NextResponse } from "next/server";
import { getBusLineDetail, haversineMeters, type BusStop } from "@/lib/bus/crtm";

export const dynamic = "force-dynamic";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function estimateRideMinutes(stops: BusStop[], from: number, to: number) {
  if (from < 0 || to < 0 || to <= from) return null;
  let seconds = 0;
  let usable = false;

  for (let i = from + 1; i <= to; i += 1) {
    const length = stops[i]?.previousLengthM;
    const speed = stops[i]?.previousSpeedKmh;
    if (length && speed && speed > 0) {
      seconds += length / (speed / 3.6);
      usable = true;
    }
  }

  return usable ? Math.max(1, Math.round(seconds / 60)) : null;
}

export async function GET(request: NextRequest) {
  try {
    const line = await getBusLineDetail("4");
    const lat = Number(request.nextUrl.searchParams.get("lat"));
    const lon = Number(request.nextUrl.searchParams.get("lon"));
    const hasUserLocation = Number.isFinite(lat) && Number.isFinite(lon);

    const byDirection = new Map<string, BusStop[]>();
    for (const stop of line.stops) {
      const key = stop.direction ?? "?";
      const bucket = byDirection.get(key) ?? [];
      bucket.push(stop);
      byDirection.set(key, bucket);
    }

    const candidates = [...byDirection.entries()].map(([direction, stops]) => {
      const ordered = [...stops].sort((a, b) => a.order - b.order);
      const originStops = ordered.filter((stop) =>
        normalize(stop.address + " " + stop.name).includes("colmenar viejo"),
      );
      const destinationStops = ordered.filter((stop) =>
        normalize(stop.address + " " + stop.name).includes("matapinonera"),
      );

      let boarding = originStops[0] ?? null;
      if (hasUserLocation && originStops.length) {
        boarding = [...originStops]
          .filter((stop) => stop.lat !== null && stop.lon !== null)
          .sort(
            (a, b) =>
              haversineMeters({ lat, lon }, { lat: a.lat!, lon: a.lon! }) -
              haversineMeters({ lat, lon }, { lat: b.lat!, lon: b.lon! }),
          )[0] ?? boarding;
      }

      const boardingIndex = boarding
        ? ordered.findIndex((stop) => stop.stationCode === boarding?.stationCode)
        : -1;

      const alighting =
        destinationStops.find((stop) => stop.order > (boarding?.order ?? -1)) ??
        destinationStops[0] ??
        null;

      const alightingIndex = alighting
        ? ordered.findIndex((stop) => stop.stationCode === alighting.stationCode)
        : -1;

      return {
        direction,
        boarding,
        alighting,
        boardingWalkMeters:
          hasUserLocation && boarding?.lat !== null && boarding?.lon !== null
            ? Math.round(
                haversineMeters(
                  { lat, lon },
                  { lat: boarding.lat!, lon: boarding.lon! },
                ),
              )
            : null,
        estimatedRideMinutes: estimateRideMinutes(
          ordered,
          boardingIndex,
          alightingIndex,
        ),
        stops: ordered,
      };
    });

    const viable = candidates
      .filter(
        (item) =>
          item.boarding &&
          item.alighting &&
          item.alighting.order > item.boarding.order,
      )
      .sort(
        (a, b) =>
          (a.boardingWalkMeters ?? Number.MAX_SAFE_INTEGER) -
          (b.boardingWalkMeters ?? Number.MAX_SAFE_INTEGER),
      );

    return NextResponse.json({
      source: {
        routeAndStops: "CRTM ArcGIS Open Data · M9",
        destination: "IKEA San Sebastián de los Reyes",
      },
      request: {
        origin: "Avenida de Colmenar Viejo",
        destination: "IKEA San Sebastián de los Reyes",
        userLocationUsed: hasUserLocation,
      },
      recommendedLine: "4",
      routeName: line.name,
      walkingFinalMinutes: 14,
      realtime: {
        status: "official_feed_pending",
        message:
          "CRTM confirma posición y tiempos reales en sus sistemas SAE, pero aún no hemos localizado una API pública documentada para terceros.",
      },
      best: viable[0] ?? null,
      alternatives: viable.slice(1),
      shapes: line.shapes,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "BUS_IKEA_PLAN_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
