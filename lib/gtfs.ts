import AdmZip from "adm-zip";

const RENFE_GTFS_URL =
  "https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type Row = Record<string, string>;

export type ResolvedStop = {
  stopId: string;
  stopName: string;
  stopSequence: number;
  arrivalTime: string | null;
  departureTime: string | null;
};

export type ResolvedTrip = {
  tripId: string;
  routeId: string | null;
  routeShortName: string | null;
  routeLongName: string | null;
  serviceId: string | null;
  tripHeadsign: string | null;
  directionId: string | null;
  stops: ResolvedStop[];
  corridor: {
    containsAlcobendas: boolean;
    containsChamartin: boolean;
    alcobendasBeforeChamartin: boolean;
    matchesPattern: boolean;
  };
};

type GtfsIndex = {
  trips: Map<string, Row>;
  routes: Map<string, Row>;
  stops: Map<string, Row>;
  stopTimesByTrip: Map<string, Row[]>;
};

let cached: { at: number; promise: Promise<GtfsIndex> } | null = null;

function parseCsv(input: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const [header, ...body] = rows;
  if (!header) return [];

  return body
    .filter((values) => values.some((value) => value.length > 0))
    .map((values) =>
      Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])),
    );
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function readText(zip: AdmZip, fileName: string): string {
  const entry = zip.getEntry(fileName);
  if (!entry) throw new Error(`Missing GTFS file: ${fileName}`);
  return entry.getData().toString("utf8");
}

async function buildIndex(): Promise<GtfsIndex> {
  const response = await fetch(RENFE_GTFS_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`GTFS download failed: ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const zip = new AdmZip(bytes);

  const trips = parseCsv(readText(zip, "trips.txt"));
  const routes = parseCsv(readText(zip, "routes.txt"));
  const stops = parseCsv(readText(zip, "stops.txt"));
  const stopTimes = parseCsv(readText(zip, "stop_times.txt"));

  const stopTimesByTrip = new Map<string, Row[]>();
  for (const item of stopTimes) {
    const tripId = item.trip_id;
    if (!tripId) continue;
    const bucket = stopTimesByTrip.get(tripId) ?? [];
    bucket.push(item);
    stopTimesByTrip.set(tripId, bucket);
  }

  for (const bucket of stopTimesByTrip.values()) {
    bucket.sort(
      (a, b) => Number(a.stop_sequence || 0) - Number(b.stop_sequence || 0),
    );
  }

  return {
    trips: new Map(trips.map((row) => [row.trip_id, row])),
    routes: new Map(routes.map((row) => [row.route_id, row])),
    stops: new Map(stops.map((row) => [row.stop_id, row])),
    stopTimesByTrip,
  };
}

export async function getGtfsIndex(): Promise<GtfsIndex> {
  const now = Date.now();
  if (!cached || now - cached.at > CACHE_TTL_MS) {
    cached = { at: now, promise: buildIndex() };
  }
  try {
    return await cached.promise;
  } catch (error) {
    cached = null;
    throw error;
  }
}

export async function resolveTrip(tripId: string): Promise<ResolvedTrip | null> {
  const index = await getGtfsIndex();
  const trip = index.trips.get(tripId);
  if (!trip) return null;

  const route = trip.route_id ? index.routes.get(trip.route_id) : undefined;
  const stopTimes = index.stopTimesByTrip.get(tripId) ?? [];

  const stops = stopTimes.map((item) => {
    const stop = index.stops.get(item.stop_id);
    return {
      stopId: item.stop_id,
      stopName: stop?.stop_name ?? item.stop_id,
      stopSequence: Number(item.stop_sequence || 0),
      arrivalTime: item.arrival_time || null,
      departureTime: item.departure_time || null,
    };
  });

  const names = stops.map((stop) => normalizeName(stop.stopName));
  const alcobendasIndex = names.findIndex(
    (name) =>
      name.includes("alcobendas") &&
      (name.includes("san sebastian") || name.includes("s s de los reyes")),
  );
  const chamartinIndex = names.findIndex((name) => name.includes("chamartin"));

  const containsAlcobendas = alcobendasIndex >= 0;
  const containsChamartin = chamartinIndex >= 0;
  const alcobendasBeforeChamartin =
    containsAlcobendas &&
    containsChamartin &&
    alcobendasIndex < chamartinIndex;

  return {
    tripId,
    routeId: trip.route_id || null,
    routeShortName: route?.route_short_name || null,
    routeLongName: route?.route_long_name || null,
    serviceId: trip.service_id || null,
    tripHeadsign: trip.trip_headsign || null,
    directionId: trip.direction_id || null,
    stops,
    corridor: {
      containsAlcobendas,
      containsChamartin,
      alcobendasBeforeChamartin,
      matchesPattern: alcobendasBeforeChamartin,
    },
  };
}
