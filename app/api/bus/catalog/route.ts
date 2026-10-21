import { NextResponse } from "next/server";
import { BUS_LINES } from "@/lib/bus/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    source: "CRTM · líneas por municipio + red ArcGIS",
    count: BUS_LINES.length,
    urbanCount: BUS_LINES.filter((line) => line.network === "urban").length,
    interurbanCount: BUS_LINES.filter((line) => line.network === "interurban").length,
    lines: BUS_LINES,
  });
}
