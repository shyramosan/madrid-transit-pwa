import { NextResponse } from "next/server";
import {
  RENFE_VEHICLES_URL,
  fetchJson,
  looksLikeC4,
  normalizeVehicle,
  type RenfeFeed,
} from "@/lib/renfe";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const feed = await fetchJson<RenfeFeed>(RENFE_VEHICLES_URL);
    const vehicles = (feed.entity ?? [])
      .filter((entity) => entity.vehicle)
      .filter(looksLikeC4)
      .map(normalizeVehicle);

    return NextResponse.json({
      source: "Renfe Open Data · vehicle_positions.json",
      feedTimestamp: feed.header?.timestamp ?? null,
      count: vehicles.length,
      vehicles,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "RENFE_UPSTREAM_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
