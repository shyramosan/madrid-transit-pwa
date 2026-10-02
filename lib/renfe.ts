export const RENFE_VEHICLES_URL = "https://gtfsrt.renfe.com/vehicle_positions.json";
export const RENFE_TRIPS_URL = "https://gtfsrt.renfe.com/trip_updates.json";

export type RenfeFeed = {
  header?: {
    gtfsRealtimeVersion?: string;
    timestamp?: string;
  };
  entity?: RenfeEntity[];
};

export type RenfeEntity = {
  id?: string;
  vehicle?: {
    trip?: { tripId?: string };
    position?: { latitude?: number; longitude?: number };
    currentStatus?: "INCOMING_AT" | "STOPPED_AT" | "IN_TRANSIT_TO" | string;
    timestamp?: string;
    stopId?: string;
    vehicle?: { id?: string; label?: string };
  };
  tripUpdate?: unknown;
};

export function looksLikeC4(entity: RenfeEntity): boolean {
  const tripId = entity.vehicle?.trip?.tripId ?? "";
  const label = entity.vehicle?.vehicle?.label ?? "";
  const id = entity.id ?? "";
  return /(^|[-_])C4\b/i.test(label) || /C4$/i.test(tripId) || /(^|[-_])C4\b/i.test(id);
}

export function normalizeVehicle(entity: RenfeEntity) {
  const vehicle = entity.vehicle;
  return {
    entityId: entity.id ?? null,
    tripId: vehicle?.trip?.tripId ?? null,
    vehicleId: vehicle?.vehicle?.id ?? null,
    label: vehicle?.vehicle?.label ?? null,
    latitude: vehicle?.position?.latitude ?? null,
    longitude: vehicle?.position?.longitude ?? null,
    currentStatus: vehicle?.currentStatus ?? null,
    stopId: vehicle?.stopId ?? null,
    timestamp: vehicle?.timestamp ?? null,
    branch: "unresolved" as const,
  };
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Upstream request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
