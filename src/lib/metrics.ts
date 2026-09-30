import "server-only";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { hashtagStats } from "./hashtags";
import { db, schema } from "./db";
import type { Network } from "./db/schema";
import { daysInMonth } from "./dates";
import { mediaByPostFirst } from "./queries";
import { monthsBack, shapeMetrics, type RawMetric } from "./metrics-shape";

export type { MonthRow } from "./metrics-shape";

/** Métricas mensuales + piezas publicadas para el tablero y el reporte. */
export function loadMetrics(clientId: string, month: string, networks: Network[], span = 6) {
  const months = monthsBack(month, span);
  const rows = db
    .select()
    .from(schema.metrics)
    .where(and(eq(schema.metrics.clientId, clientId), gte(schema.metrics.month, months[0]), lte(schema.metrics.month, month)))
    .all();

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
    .all();
  const thumbs = mediaByPostFirst(published.map((p) => p.id));

  return shapeMetrics(
    month,
    networks,
    rows as RawMetric[],
    published.map((p) => ({ ...p, thumb: thumbs.get(p.id) ?? null })),
    span,
  );
}

/** Hashtags de las piezas del período (para ver cuáles rindieron mejor). */
export function loadHashtagStats(clientId: string, month: string, span = 6) {
  const from = `${monthsBack(month, span)[0]}-01`;
  const to = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const rows = db
    .select({ caption: schema.posts.caption, date: schema.posts.date, postMetrics: schema.posts.postMetrics })
    .from(schema.posts)
    .where(and(eq(schema.posts.clientId, clientId), gte(schema.posts.date, from), lte(schema.posts.date, to)))
    .all();
  return hashtagStats(rows);
}
