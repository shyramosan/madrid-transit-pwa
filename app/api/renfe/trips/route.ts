import { NextResponse } from "next/server";
import { RENFE_TRIPS_URL, fetchJson, type RenfeFeed } from "@/lib/renfe";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const feed = await fetchJson<RenfeFeed>(RENFE_TRIPS_URL);
    return NextResponse.json({
      source: "Renfe Open Data · trip_updates.json",
      feedTimestamp: feed.header?.timestamp ?? null,
      entityCount: feed.entity?.length ?? 0,
      entities: feed.entity ?? [],
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
