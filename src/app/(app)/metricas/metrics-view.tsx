"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, FileText, Minus, Upload } from "lucide-react";
import type { Network } from "@/lib/db/schema";
import type { MetricsData, MonthRow } from "@/lib/metrics-shape";
import { NETWORK_LABEL } from "@/lib/constants";
import { NETWORK_COLOR, shortMonth } from "@/lib/chart-colors";
import { monthLabel, shiftMonth, MONTHS, formatDayShort } from "@/lib/dates";
import { cn, formatNumber } from "@/lib/utils";
import { url } from "@/lib/base";
import { PageHeader } from "@/components/ui/page-header";
import { NetworkIcon } from "@/components/ui/network-icon";
import { Sheet } from "@/components/ui/sheet";
import { FormatTag, Thumb } from "@/components/post/bits";
import { ColumnChart, LineChart, Sparkline } from "@/components/charts/charts";
import { saveMonthMetrics, type MetricInput } from "../actions/metrics";
import { bestTags, formatLift, formatRate, MIN_MEASURED, type TagStats } from "@/lib/hashtags";

type Data = MetricsData;

export function MetricsView({
  clientId,
  clientName,
  clientNetworks,
  month,
  current,
  red,
  data,
  formInitial,
  hashtags,
}: {
  clientId: string;
  clientName: string;
  clientNetworks: Network[];
  month: string;
  current: string;
  red: Network | null;
  data: Data;
  formInitial: (MonthRow & { network: Network })[];
  hashtags?: TagStats;
}) {
  const [loading, setLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const href = (m: string, r: Network | null = red) => `/metricas?mes=${m}${r ? `&red=${r}` : ""}`;
  const last = data.months.length - 1;
  const t = data.totals;
  const rate = (i: number) => (t.reach[i] && t.interactions[i] !== null ? (t.interactions[i]! / t.reach[i]!) * 100 : null);
  const monthHasData = t.followers[last] !== null || t.reach[last] !== null;
  const networks = red ? [red] : clientNetworks;

  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-12 lg:px-8">
      <PageHeader
        title="Métricas"
        subtitle={`Cómo le fue a ${clientName} mes a mes.`}
        action={
          <div className="flex gap-2">
            <button className="btn-ghost btn-sm" onClick={() => setExportOpen(true)}>
              <Download className="size-4" /> <span className="hidden sm:inline">Exportar</span>
            </button>
            <button className="btn-primary btn-sm" onClick={() => setLoading(true)}>
              <Upload className="size-4" /> <span className="hidden sm:inline">Cargar datos</span>
            </button>
          </div>
        }
      />

      {/* Filtros: una fila, arriba de todo */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
          <Link href={href(shiftMonth(month, -1))} className="grid size-8 place-items-center rounded-full hover:bg-sunken" aria-label="Mes anterior">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-[128px] text-center text-[14px] font-semibold capitalize">{monthLabel(month)}</span>
          <Link
            href={href(shiftMonth(month, 1))}
            aria-disabled={month >= current}
            className={cn("grid size-8 place-items-center rounded-full hover:bg-sunken", month >= current && "pointer-events-none opacity-30")}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <Link href={href(month, null)} className="chip" data-on={!red}>
            Todas
          </Link>
          {clientNetworks.map((n) => (
            <Link key={n} href={href(month, n)} className="chip" data-on={red === n}>
              <NetworkIcon network={n} /> {NETWORK_LABEL[n]}
            </Link>
          ))}
        </div>
      </div>

      {!monthHasData && (
        <div className="card mb-5 flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-semibold">Falta cargar {monthLabel(month)}</p>
            <p className="text-[14px] text-muted">Copiá los números de Meta Business Suite o TikTok Studio y en un minuto tenés el reporte.</p>
          </div>
          <button className="btn-accent btn-sm" onClick={() => setLoading(true)}>
            Cargar ahora
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Seguidores" values={t.followers} last={last} />
        <Stat label="Alcance" values={t.reach} last={last} />
        <Stat label="Interacciones" values={t.interactions} last={last} />
        <Stat label="Tasa de interacción" values={data.months.map((_, i) => rate(i))} last={last} suffix="%" decimals={1} points />
        <div className="card col-span-2 flex items-center justify-between p-4 lg:col-span-1 lg:block">
          <p className="text-[13px] text-muted">Publicado este mes</p>
          <p className="font-display text-[28px] font-bold leading-tight lg:mt-1">{data.publishedCount}</p>
          <p className="hidden text-[12.5px] text-muted lg:block">piezas en estado “Publicado”</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-4 lg:p-5">
          <h2 className="font-semibold">Seguidores por red</h2>
          <p className="mb-3 text-[13px] text-muted">Últimos 6 meses</p>
          <LineChart
            labels={data.months.map(shortMonth)}
            series={networks.map((n) => ({ key: n, label: NETWORK_LABEL[n], color: NETWORK_COLOR[n], values: data.byNetwork[n].map((r) => r.followers) }))}
          />
          {networks.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-4 text-[12.5px] text-ink-2">
              {networks.map((n) => (
                <span key={n} className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-full" style={{ background: NETWORK_COLOR[n] }} /> {NETWORK_LABEL[n]}
                </span>
              ))}
            </div>
          )}
        </section>
        <section className="card p-4 lg:p-5">
          <h2 className="font-semibold">Alcance total</h2>
          <p className="mb-3 text-[13px] text-muted">Cuentas únicas alcanzadas, {red ? NETWORK_LABEL[red] : "todas las redes"}</p>
          <ColumnChart labels={data.months.map(shortMonth)} values={t.reach} highlight={last} label="alcance" />
        </section>
      </div>

      <section className="card mt-5 overflow-hidden">
        <div className="flex items-baseline justify-between p-4 lg:p-5">
          <h2 className="font-semibold">Mejores publicaciones de {MONTHS[Number(month.slice(5)) - 1]}</h2>
          <span className="text-[12.5px] text-muted">por interacciones</span>
        </div>
        {data.top.length === 0 ? (
          <p className="px-5 pb-6 text-[14px] text-muted">
            No hay piezas publicadas este mes. Cuando marques una pieza como “Publicado”, cargale los resultados desde su ficha.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13.5px]">
              <thead>
                <tr className="border-y border-line text-left text-[12px] text-muted">
                  <th className="px-4 py-2 font-medium lg:px-5">Pieza</th>
                  <th className="px-3 py-2 text-right font-medium">Alcance</th>
                  <th className="px-3 py-2 text-right font-medium">Interacciones</th>
                  <th className="px-3 py-2 text-right font-medium">Guardados</th>
                  <th className="px-4 py-2 text-right font-medium lg:px-5">Tasa</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {data.top.slice(0, 8).map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 lg:px-5">
                      <Link href={`/posts/${p.id}`} className="flex items-center gap-3">
                        <Thumb media={p.thumb} format={p.format} className="h-11 w-9 shrink-0" rounded="rounded-md" badge={false} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{p.title}</span>
                          <span className="flex items-center gap-2 text-[12px] text-muted">
                            {formatDayShort(p.date)} <FormatTag format={p.format} />
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 text-right">{p.metrics.reach.toLocaleString("es-AR")}</td>
                    <td className="px-3 text-right font-semibold">{p.interactions.toLocaleString("es-AR")}</td>
                    <td className="px-3 text-right">{p.metrics.saves.toLocaleString("es-AR")}</td>
                    <td className="px-4 text-right lg:px-5">{(p.rate * 100).toFixed(1)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {hashtags && <HashtagCard stats={hashtags} />}

      <details className="card mt-5 p-4 lg:p-5">
        <summary className="cursor-pointer text-[14px] font-semibold">Ver todos los datos en tabla</summary>
        <DataTable data={data} networks={networks} />
      </details>

      <Sheet open={loading} onClose={() => setLoading(false)} title={`Cargar ${monthLabel(month)}`} wide>
        <MonthForm clientId={clientId} month={month} initial={formInitial} onDone={() => setLoading(false)} />
      </Sheet>

      <Sheet open={exportOpen} onClose={() => setExportOpen(false)} title="Exportar">
        <div className="space-y-2">
          <a href={url(`/metricas/reporte?mes=${month}`)} className="flex items-center gap-3 rounded-2xl border border-line p-3.5 hover:border-ink">
            <span className="grid size-10 place-items-center rounded-xl bg-sunken">
              <FileText className="size-5" />
            </span>
            <span>
              <span className="block font-semibold">Reporte para el cliente</span>
              <span className="block text-[13px] text-muted">Página lista para imprimir o guardar como PDF</span>
            </span>
          </a>
          <a href={url(`/api/export/metricas?mes=${month}`)} className="flex items-center gap-3 rounded-2xl border border-line p-3.5 hover:border-ink">
            <span className="grid size-10 place-items-center rounded-xl bg-sunken">
              <Download className="size-5" />
            </span>
            <span>
              <span className="block font-semibold">Planilla CSV</span>
              <span className="block text-[13px] text-muted">Para abrir en Excel o Google Sheets</span>
            </span>
          </a>
        </div>
      </Sheet>
    </div>
  );
}

export function Stat({
  label,
  values,
  last,
  suffix = "",
  decimals = 0,
  points = false,
}: {
  label: string;
  values: (number | null)[];
  last: number;
  suffix?: string;
  decimals?: number;
  /** Para tasas: la variación va en puntos porcentuales, no en %. */
  points?: boolean;
}) {
  const v = values[last];
  const prev = values[last - 1];
  const has = v !== null && prev !== null && prev !== undefined;
  const delta = !has ? null : points ? v - prev : prev !== 0 ? ((v - prev) / prev) * 100 : null;
  const flat = delta !== null && Math.abs(delta) < (points ? 0.05 : 0.5);
  const fmt = (x: number) => (decimals ? x.toFixed(decimals).replace(".", ",") : formatNumber(x));
  return (
    <div className="card p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="font-display text-[28px] font-bold leading-tight">{v === null ? "—" : `${fmt(v)}${suffix}`}</p>
        <span className="mb-1.5 hidden shrink-0 sm:block">
          <Sparkline values={values} width={64} height={24} />
        </span>
      </div>
      {delta === null ? (
        <p className="mt-1 text-[12.5px] text-muted">sin mes anterior</p>
      ) : (
        <p className="mt-1 flex flex-wrap items-center gap-x-1 text-[12.5px]">
          <span className={cn("flex items-center gap-0.5 font-semibold", flat ? "text-muted" : delta > 0 ? "text-st-approved" : "text-st-changes")}>
            {flat ? <Minus className="size-3.5" /> : delta > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1).replace(".", ",")}
            {points ? " pp" : "%"}
          </span>
          <span className="text-muted">vs mes anterior</span>
        </p>
      )}
    </div>
  );
}

export function DataTable({ data, networks }: { data: Data; networks: Network[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[520px] text-[13px] tabular-nums">
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-muted">
            <th className="py-2 pr-3 font-medium">Mes</th>
            <th className="py-2 pr-3 font-medium">Red</th>
            <th className="py-2 pr-3 text-right font-medium">Seguidores</th>
            <th className="py-2 pr-3 text-right font-medium">Alcance</th>
            <th className="py-2 pr-3 text-right font-medium">Impresiones</th>
            <th className="py-2 pr-3 text-right font-medium">Interacciones</th>
            <th className="py-2 text-right font-medium">Visitas al perfil</th>
          </tr>
        </thead>
        <tbody>
          {data.months.map((m, i) =>
            networks.map((n) => {
              const r = data.byNetwork[n][i];
              const f = (x: number | null) => (x === null ? "—" : x.toLocaleString("es-AR"));
              return (
                <tr key={m + n} className="border-b border-line/70">
                  <td className="py-1.5 pr-3 capitalize">{monthLabel(m)}</td>
                  <td className="py-1.5 pr-3">{NETWORK_LABEL[n]}</td>
                  <td className="py-1.5 pr-3 text-right">{f(r.followers)}</td>
                  <td className="py-1.5 pr-3 text-right">{f(r.reach)}</td>
                  <td className="py-1.5 pr-3 text-right">{f(r.impressions)}</td>
                  <td className="py-1.5 pr-3 text-right">{f(r.interactions)}</td>
                  <td className="py-1.5 text-right">{f(r.profileVisits)}</td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}

const FIELDS: { key: keyof Omit<MetricInput, "network">; label: string; hint: string }[] = [
  { key: "followers", label: "Seguidores", hint: "al cierre del mes" },
  { key: "reach", label: "Alcance", hint: "cuentas alcanzadas" },
  { key: "impressions", label: "Impresiones", hint: "o visualizaciones" },
  { key: "interactions", label: "Interacciones", hint: "me gusta + comentarios + guardados + compartidos" },
  { key: "profileVisits", label: "Visitas al perfil", hint: "" },
];

function MonthForm({
  clientId,
  month,
  initial,
  onDone,
}: {
  clientId: string;
  month: string;
  initial: (MonthRow & { network: Network })[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Network>(initial[0]?.network ?? "instagram");
  const [rows, setRows] = useState<MetricInput[]>(
    initial.map((r) => ({
      network: r.network,
      followers: r.followers ?? 0,
      reach: r.reach ?? 0,
      impressions: r.impressions ?? 0,
      interactions: r.interactions ?? 0,
      profileVisits: r.profileVisits ?? 0,
    })),
  );
  const [pending, start] = useTransition();
  const row = rows.find((r) => r.network === tab)!;

  return (
    <div>
      <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
        {rows.map((r) => (
          <button key={r.network} className="chip" data-on={tab === r.network} onClick={() => setTab(r.network)}>
            <NetworkIcon network={r.network} /> {NETWORK_LABEL[r.network]}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block rounded-xl border border-line bg-surface px-3.5 py-2.5 focus-within:border-ink">
            <span className="block text-[13px] font-medium text-ink-2">
              {f.label} {f.hint && <span className="font-normal text-muted">· {f.hint}</span>}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={row[f.key] || ""}
              placeholder="0"
              onChange={(e) => setRows((prev) => prev.map((r) => (r.network === tab ? { ...r, [f.key]: Number(e.target.value) } : r)))}
              className="w-full bg-transparent font-display text-[22px] font-bold outline-none"
            />
          </label>
        ))}
      </div>
      <button
        className="btn-primary mt-5 w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await saveMonthMetrics(
              clientId,
              month,
              rows.filter((r) => r.followers || r.reach || r.impressions || r.interactions || r.profileVisits),
            );
            router.refresh();
            onDone();
          })
        }
      >
        {pending ? "Guardando…" : "Guardar métricas"}
      </button>
    </div>
  );
}

function HashtagCard({ stats }: { stats: TagStats }) {
  const best = bestTags(stats, 8);
  return (
    <section className="card mt-5 overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 p-4 lg:p-5">
        <h2 className="font-semibold">Hashtags que mejor funcionan</h2>
        <span className="text-[12.5px] text-muted">últimos 6 meses · contra el promedio de la cuenta</span>
      </div>
      {best.length ? (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-[13.5px]">
            <thead>
              <tr className="border-y border-line text-left text-[12px] text-muted">
                <th className="px-4 py-2 font-medium lg:px-5">Hashtag</th>
                <th className="w-[56px] px-2 py-2 text-right font-medium sm:w-[120px]">
                  Piezas<span className="hidden sm:inline"> medidas</span>
                </th>
                <th className="w-[86px] px-2 py-2 text-right font-medium sm:w-[120px]">Interacción</th>
                <th className="w-[92px] px-4 py-2 text-right font-medium sm:w-[150px] lg:px-5">Rinde</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {best.map((t) => (
                <tr key={t.tag} className="border-b border-line last:border-0">
                  <td className="truncate px-4 py-2.5 font-semibold lg:px-5">{t.tag}</td>
                  <td className="px-2 text-right">{t.measured}</td>
                  <td className="px-2 text-right">{formatRate(t.rate ?? 0)}</td>
                  <td className={cn("px-4 text-right font-semibold lg:px-5", t.lift! > 0 ? "text-st-approved" : "text-muted")}>
                    {Math.round(t.lift! * 100) === 0 ? "= prom." : formatLift(t.lift!)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stats.baseline !== null && (
            <p className="border-t border-line px-4 py-3 text-[12.5px] text-muted lg:px-5">
              Promedio de la cuenta: {formatRate(stats.baseline)} de interacción (me gusta, comentarios, guardados y compartidos sobre el alcance).
            </p>
          )}
        </div>
      ) : (
        <div className="px-4 pb-5 lg:px-5">
          <p className="text-[14px] text-muted">
            {stats.tags.length
              ? `Todavía no hay datos suficientes: hace falta que un hashtag esté en al menos ${MIN_MEASURED} piezas publicadas con resultados cargados.`
              : "No hay hashtags en las piezas de estos meses."}
          </p>
          {stats.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {stats.tags.slice(0, 12).map((t) => (
                <span key={t.tag} className="rounded-full bg-sunken px-2.5 py-1 text-[13px]">
                  {t.tag} <span className="text-muted tabular-nums">×{t.uses}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
