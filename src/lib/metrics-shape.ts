// Arma totales, series y ranking de métricas a partir de filas crudas.
// Lo usan tanto el servidor Next como la versión PHP (que hace este cálculo en el navegador).
import type { Network, PostFormat, PostMetrics } from "./db/schema";
import type { MediaDTO } from "./queries";
import { shiftMonth } from "./dates";

export type MonthRow = {
  month: string;
  followers: number | null;
  reach: number | null;
  impressions: number | null;
  interactions: number | null;
  profileVisits: number | null;
};

export type RawMetric = Omit<MonthRow, "month"> & { network: Network; month: string };

export type RawPublished = {
  id: string;
  title: string;
  date: string;
  format: PostFormat;
  networks: Network[];
  postMetrics: PostMetrics | null;
  thumb: MediaDTO | null;
};

export function monthsBack(month: string, span: number) {
  return Array.from({ length: span }, (_, i) => shiftMonth(month, i - (span - 1)));
}

export function shapeMetrics(month: string, networks: Network[], rows: RawMetric[], published: RawPublished[], span = 6) {
  const months = monthsBack(month, span);
  const byNetwork = Object.fromEntries(
    networks.map((n) => [
      n,
      months.map((m) => {
        const r = rows.find((x) => x.network === n && x.month === m);
        return {
          month: m,
          followers: r?.followers ?? null,
          reach: r?.reach ?? null,
          impressions: r?.impressions ?? null,
          interactions: r?.interactions ?? null,
          profileVisits: r?.profileVisits ?? null,
        } satisfies MonthRow;
      }),
    ]),
  ) as Record<Network, MonthRow[]>;

  // Totales (suma de redes); null si ninguna red cargó ese mes.
  const sum = (key: keyof Omit<MonthRow, "month">) =>
    months.map((_, i) => {
      const vals = networks.map((n) => byNetwork[n][i][key]).filter((v): v is number => v !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    });
  const totals = {
    followers: sum("followers"),
    reach: sum("reach"),
    impressions: sum("impressions"),
    interactions: sum("interactions"),
    profileVisits: sum("profileVisits"),
  };

  const inScope = published.filter((p) => p.date.startsWith(month) && p.networks.some((n) => networks.includes(n)));
  const top = inScope
    .filter((p) => p.postMetrics)
    .map((p) => {
      const m = p.postMetrics!;
      const interactions = m.likes + m.comments + m.saves + m.shares;
      return {
        id: p.id,
        title: p.title,
        date: p.date,
        format: p.format,
        thumb: p.thumb,
        metrics: m,
        interactions,
        rate: m.reach ? interactions / m.reach : 0,
      };
    })
    .sort((a, b) => b.interactions - a.interactions);

  const hasData = rows.some((r) => months.includes(r.month) && networks.includes(r.network));
  return { months, byNetwork, totals, top, publishedCount: inScope.length, hasData };
}

export type MetricsData = ReturnType<typeof shapeMetrics>;
