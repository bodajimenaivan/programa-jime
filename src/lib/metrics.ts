import "server-only";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "./db";
import type { Network, PostMetrics } from "./db/schema";
import { daysInMonth, shiftMonth } from "./dates";
import { mediaByPostFirst } from "./queries";

export type MonthRow = {
  month: string;
  followers: number | null;
  reach: number | null;
  impressions: number | null;
  interactions: number | null;
  profileVisits: number | null;
};

/** Métricas mensuales + piezas publicadas para el tablero y el reporte. */
export function loadMetrics(clientId: string, month: string, networks: Network[], span = 6) {
  const months = Array.from({ length: span }, (_, i) => shiftMonth(month, i - (span - 1)));
  const rows = db
    .select()
    .from(schema.metrics)
    .where(and(eq(schema.metrics.clientId, clientId), gte(schema.metrics.month, months[0]), lte(schema.metrics.month, month)))
    .all();

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

  const published = db
    .select()
    .from(schema.posts)
    .where(
      and(
        eq(schema.posts.clientId, clientId),
        inArray(schema.posts.status, ["published"]),
        gte(schema.posts.date, `${month}-01`),
        lte(schema.posts.date, `${month}-${String(daysInMonth(month)).padStart(2, "0")}`),
      ),
    )
    .all()
    .filter((p) => p.networks.some((n) => networks.includes(n)));

  const thumbs = mediaByPostFirst(published.map((p) => p.id));
  const top = published
    .filter((p) => p.postMetrics)
    .map((p) => {
      const m: PostMetrics = p.postMetrics ?? { reach: 0, likes: 0, comments: 0, saves: 0, shares: 0, views: 0 };
      const interactions = m.likes + m.comments + m.saves + m.shares;
      return {
        id: p.id,
        title: p.title,
        date: p.date,
        format: p.format,
        thumb: thumbs.get(p.id) ?? null,
        metrics: m,
        interactions,
        rate: m.reach ? interactions / m.reach : 0,
      };
    })
    .sort((a, b) => b.interactions - a.interactions);

  return { months, byNetwork, totals, top, publishedCount: published.length, hasData: rows.length > 0 };
}
