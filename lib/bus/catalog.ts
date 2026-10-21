export type BusNetwork = "urban" | "interurban";

export type BusLineCatalogItem = {
  line: string;
  name: string;
  network: BusNetwork;
  municipalities: Array<"Alcobendas" | "San Sebastián de los Reyes">;
};

export const BUS_LINES: BusLineCatalogItem[] = [
  { line: "1", name: "Arroyo de la Vega - El Soto - La Moraleja", network: "urban", municipalities: ["Alcobendas"] },
  { line: "2", name: "Alcobendas - La Moraleja", network: "urban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "3", name: "Arroyo de la Vega - Soto de la Moraleja - El Encinar", network: "urban", municipalities: ["Alcobendas"] },
  { line: "4", name: "Polideportivo - Moscatelares", network: "urban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "5", name: "S.S. de los Reyes - Alcobendas - Soto Moraleja", network: "urban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "6", name: "Valdelasfuentes - Polígono Industrial", network: "urban", municipalities: ["Alcobendas"] },
  { line: "7", name: "Estación FFCC - Polígonos - Estación FFCC", network: "urban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "8", name: "Circular Ciudalcampo", network: "urban", municipalities: ["San Sebastián de los Reyes"] },
  { line: "9", name: "Estación FFCC - Arroyo de la Vega", network: "urban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "10", name: "Circular de Alcobendas", network: "urban", municipalities: ["Alcobendas"] },
  { line: "11", name: "Circular de Alcobendas", network: "urban", municipalities: ["Alcobendas"] },

  { line: "151", name: "Madrid (Plaza de Castilla) - Alcobendas", network: "interurban", municipalities: ["Alcobendas"] },
  { line: "152C", name: "Madrid (Plaza de Castilla) - S.S. de los Reyes (Dehesa Vieja)", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "153", name: "Madrid (Plaza de Castilla) - Alcobendas - Rosa Luxemburgo", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "154", name: "Madrid (Chamartín) - S.S. Reyes Circular (por Fuencarral)", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "154C", name: "Madrid (Plaza de Castilla) - S.S. de los Reyes (Av. Quiñones)", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "155", name: "Madrid (Plaza de Castilla) - El Soto de la Moraleja", network: "interurban", municipalities: ["Alcobendas"] },
  { line: "155B", name: "Madrid (Plaza de Castilla) - El Encinar de los Reyes", network: "interurban", municipalities: ["Alcobendas"] },
  { line: "156", name: "Madrid (Plaza de Castilla) - S.S. de los Reyes (Moscatelares)", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "157", name: "Madrid (Plaza de Castilla) - Alcobendas (P. Chopera)", network: "interurban", municipalities: ["Alcobendas"] },
  { line: "157C", name: "Madrid (Plaza de Castilla) - Alcobendas (Valdelasfuentes)", network: "interurban", municipalities: ["Alcobendas"] },
  { line: "158", name: "Madrid (Pinar de Chamartín) - S.S. de los Reyes (Tempranales)", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "159", name: "Madrid (Plaza de Castilla) - Alcobendas (Arroyo de la Vega)", network: "interurban", municipalities: ["Alcobendas"] },
  { line: "161", name: "Madrid (Plaza de Castilla) - Fuente del Fresno", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "166", name: "S.S. de los Reyes - Urbanización Valdelagua", network: "interurban", municipalities: ["San Sebastián de los Reyes"] },
  { line: "171", name: "Madrid (Plaza de Castilla) - Urb. Santo Domingo", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "180", name: "Alcobendas - Algete", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "181", name: "Madrid (Plaza de Castilla) - Algete", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "182", name: "Madrid (Plaza de Castilla) - Algete - Valdeolmos", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "183", name: "Madrid (Plaza de Castilla) - Cobeña - Algete", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "184", name: "Madrid (Plaza de Castilla) - El Casar", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "185", name: "Madrid (Plaza de Castilla) - Nuevo Algete", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "191", name: "Madrid (Plaza de Castilla) - Buitrago", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "193", name: "Madrid (Plaza de Castilla) - Pedrezuela - El Vellón", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "194", name: "Madrid (Plaza de Castilla) - Rascafría", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "195", name: "Madrid (Plaza de Castilla) - Braojos", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "196", name: "Madrid (Plaza de Castilla) - La Acebeda", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "197", name: "Madrid (Plaza de Castilla) - Torrelaguna / Uceda", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "210", name: "S.S. de los Reyes (Hospital) - Paracuellos de Jarama", network: "interurban", municipalities: ["San Sebastián de los Reyes"] },
  { line: "714", name: "Madrid - Universidad Autónoma - Universidad Comillas", network: "interurban", municipalities: ["Alcobendas"] },
  { line: "827", name: "Madrid (Canillejas) - Alcobendas - UAM - Tres Cantos", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "827A", name: "Alcobendas - S.S. de los Reyes - Universidad Autónoma", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "828", name: "Madrid (Canillejas) - Alcobendas - Universidad Autónoma", network: "interurban", municipalities: ["Alcobendas"] },
  { line: "N101", name: "Madrid (Plaza de Castilla) - Alcobendas", network: "interurban", municipalities: ["Alcobendas"] },
  { line: "N102", name: "Madrid (Plaza de Castilla) - S.S. de los Reyes", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "N103", name: "Madrid (Plaza de Castilla) - Algete", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
  { line: "N104", name: "Madrid (Plaza de Castilla) - San Agustín de Guadalix", network: "interurban", municipalities: ["Alcobendas", "San Sebastián de los Reyes"] },
];

export function findBusLine(line: string) {
  return BUS_LINES.find((item) => item.line.toUpperCase() === line.toUpperCase()) ?? null;
}
