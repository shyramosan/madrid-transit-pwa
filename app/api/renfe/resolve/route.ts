import { NextRequest, NextResponse } from "next/server";
import { resolveTrip } from "@/lib/gtfs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tripId = request.nextUrl.searchParams.get("tripId");
  if (!tripId) {
    return NextResponse.json(
      { error: "MISSING_TRIP_ID", message: "Use ?tripId=..." },
      { status: 400 },
    );
  }

  try {
    const trip = await resolveTrip(tripId);
    if (!trip) {
      return NextResponse.json(
        { error: "TRIP_NOT_FOUND", tripId },
        { status: 404 },
      );
    }

    return NextResponse.json({
      source: "Renfe GTFS static",
      resolvedAt: new Date().toISOString(),
      trip,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "GTFS_RESOLUTION_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
