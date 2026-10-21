import { NextRequest, NextResponse } from "next/server";
import { getBusLineDetail } from "@/lib/bus/crtm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ line: string }> },
) {
  const { line } = await context.params;

  try {
    const detail = await getBusLineDetail(line);
    return NextResponse.json({
      source: "CRTM ArcGIS Open Data · M8/M9",
      detail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message === "UNKNOWN_BUS_LINE" ? "UNKNOWN_BUS_LINE" : "CRTM_BUS_ERROR", message },
      { status: message === "UNKNOWN_BUS_LINE" ? 404 : 502 },
    );
  }
}
