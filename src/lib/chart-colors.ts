import type { Network } from "./db/schema";
import { NETWORK_ORDER } from "./constants";
import { MONTHS } from "./dates";

/** Cada red tiene su color fijo (sigue a la red, no a su posición en el gráfico). */
export const NETWORK_COLOR: Record<Network, string> = Object.fromEntries(
  NETWORK_ORDER.map((n, i) => [n, `var(--c-s${i + 1})`]),
) as Record<Network, string>;

export const shortMonth = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1].slice(0, 3);
