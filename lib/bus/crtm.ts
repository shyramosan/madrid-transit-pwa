import { findBusLine, type BusNetwork } from "./catalog";

const BASE = "https://services5.arcgis.com/UxADft6QPcvFyDU1/arcgis/rest/services";

function serviceName(network: BusNetwork) {
  return network === "urban" ? "M9_Red" : "M8_Red";
}

async function arcgisQuery<T>(
  network: BusNetwork,
  layer: 0 | 2 | 3,
  params: Record<string, string>,
): Promise<T> {
  const search = new URLSearchParams({
    f: "json",
    where: "1=1",
    outFields: "*",
    returnGeometry: "false",
    ...params,
  });

  const url = `${BASE}/${serviceName(network)}/FeatureServer/${layer}/query?${search}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) throw new Error(`CRTM ArcGIS ${response.status}`);
  const json = (await response.json()) as T & { error?: { message?: string } };
  if (json.error) throw new Error(json.error.message ?? "CRTM ArcGIS error");
  return json;
}

type ArcFeature = {
  attributes: Record<string, string | number | null>;
  geometry?: { x?: number; y?: number; paths?: number[][][] };
};

type ArcResponse = { features?: ArcFeature[] };

export type BusStop = {
  stationCode: string;
  line: string;
  direction: string | null;
  order: number;
  name: string;
  address: string;
  municipality: string;
  lat: number | null;
  lon: number | null;
  previousLengthM: number | null;
  previousSpeedKmh: number | null;
};

export type BusLineDetail = {
  line: string;
  network: BusNetwork;
  name: string;
  stops: BusStop[];
  shapes: Array<Array<[number, number]>>;
};

function esc(value: string) {
  return value.replace(/'/g, "''");
}

export async function getBusLineDetail(line: string): Promise<BusLineDetail> {
  const catalog = findBusLine(line);
  if (!catalog) throw new Error("UNKNOWN_BUS_LINE");

  const where = `NUMEROLINEAUSUARIO='${esc(catalog.line)}'`;

  const [stopRows, shapeRows] = await Promise.all([
    arcgisQuery<ArcResponse>(catalog.network, 3, {
      where,
      outFields:
        "CODIGOESTACION,NUMEROLINEAUSUARIO,SENTIDO,NUMEROORDEN,DENOMINACION,DIRECCION,MUNICIPIO,LONGITUDTRAMOANTERIOR,VELOCIDADTRAMOANTERIOR",
      orderByFields: "SENTIDO,NUMEROORDEN",
    }),
    arcgisQuery<ArcResponse>(catalog.network, 2, {
      where,
      outFields: "NUMEROLINEAUSUARIO,SENTIDO,CODIGOITINERARIO",
      returnGeometry: "true",
      outSR: "4326",
    }),
  ]);

  const stationCodes = [
    ...new Set(
      (stopRows.features ?? [])
        .map((item) => String(item.attributes.CODIGOESTACION ?? ""))
        .filter(Boolean),
    ),
  ];

  let stationRows: ArcResponse = { features: [] };
  if (stationCodes.length) {
    const stationWhere = `CODIGOESTACION IN (${stationCodes
      .map((code) => `'${esc(code)}'`)
      .join(",")})`;

    stationRows = await arcgisQuery<ArcResponse>(catalog.network, 0, {
      where: stationWhere,
      outFields: "CODIGOESTACION,DENOMINACION",
      returnGeometry: "true",
      outSR: "4326",
    });
  }

  const coords = new Map<string, { lat: number; lon: number }>();
  for (const feature of stationRows.features ?? []) {
    const code = String(feature.attributes.CODIGOESTACION ?? "");
    const x = feature.geometry?.x;
    const y = feature.geometry?.y;
    if (code && typeof x === "number" && typeof y === "number") {
      coords.set(code, { lon: x, lat: y });
    }
  }

  const stops: BusStop[] = (stopRows.features ?? []).map((feature) => {
    const a = feature.attributes;
    const stationCode = String(a.CODIGOESTACION ?? "");
    const point = coords.get(stationCode);

    return {
      stationCode,
      line: String(a.NUMEROLINEAUSUARIO ?? catalog.line),
      direction: a.SENTIDO ? String(a.SENTIDO) : null,
      order: Number(a.NUMEROORDEN ?? 0),
      name: String(a.DENOMINACION ?? stationCode),
      address: String(a.DIRECCION ?? ""),
      municipality: String(a.MUNICIPIO ?? ""),
      lat: point?.lat ?? null,
      lon: point?.lon ?? null,
      previousLengthM:
        typeof a.LONGITUDTRAMOANTERIOR === "number"
          ? a.LONGITUDTRAMOANTERIOR
          : null,
      previousSpeedKmh:
        typeof a.VELOCIDADTRAMOANTERIOR === "number"
          ? a.VELOCIDADTRAMOANTERIOR
          : null,
    };
  });

  const shapes: Array<Array<[number, number]>> = [];
  for (const feature of shapeRows.features ?? []) {
    for (const path of feature.geometry?.paths ?? []) {
      shapes.push(
        path
          .filter((point) => point.length >= 2)
          .map((point) => [Number(point[0]), Number(point[1])] as [number, number]),
      );
    }
  }

  return {
    line: catalog.line,
    network: catalog.network,
    name: catalog.name,
    stops,
    shapes,
  };
}

export function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const R = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}
