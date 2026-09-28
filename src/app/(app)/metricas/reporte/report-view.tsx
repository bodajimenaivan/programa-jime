import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Network } from "@/lib/db/schema";
import type { MetricsData } from "@/lib/metrics-shape";
import { monthLabel, formatDayShort } from "@/lib/dates";
import { NETWORK_LABEL } from "@/lib/constants";
import { ClientAvatar } from "@/components/ui/avatar";
import { FormatTag, Thumb } from "@/components/post/bits";
import { ColumnChart, LineChart } from "@/components/charts/charts";
import { DataTable, Stat } from "../metrics-view";
import { NETWORK_COLOR, shortMonth } from "@/lib/chart-colors";
import { PrintButton } from "./print-button";

type ReportClient = { name: string; color: string; avatarId: string | null; networks: Network[] };

/** Reporte mensual imprimible (lo usan la versión Next y la versión PHP). */
export function ReportView({
  client,
  workspaceName,
  month,
  data,
}: {
  client: ReportClient;
  workspaceName: string;
  month: string;
  data: MetricsData;
}) {
  const t = data.totals;
  const last = data.months.length - 1;
  const rate = data.months.map((_, i) => (t.reach[i] && t.interactions[i] !== null ? (t.interactions[i]! / t.reach[i]!) * 100 : null));

  return (
    <div className="mx-auto max-w-[900px] px-5 pb-16 pt-6 lg:px-8 lg:pt-8 print:max-w-none print:p-0">
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Link href={`/metricas?mes=${month}`} className="flex items-center gap-1.5 text-[14px] font-semibold text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" /> Métricas
        </Link>
        <PrintButton />
      </div>

      <article className="card p-5 lg:p-10 print:border-0 print:p-0">
        <header className="flex items-center gap-4 border-b border-line pb-6">
          <ClientAvatar client={client} size={56} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Reporte mensual</p>
            <h1 className="font-display text-[30px] font-bold capitalize leading-tight tracking-[-0.02em]">{monthLabel(month)}</h1>
            <p className="text-[14px] text-muted">
              {client.name} · {client.networks.map((n) => NETWORK_LABEL[n]).join(", ")}
            </p>
          </div>
          <p className="hidden text-right text-[12.5px] text-muted sm:block">
            Preparado por
            <br />
            <span className="font-semibold text-ink">{workspaceName}</span>
          </p>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 print:grid-cols-4">
          <Stat label="Seguidores" values={t.followers} last={last} />
          <Stat label="Alcance" values={t.reach} last={last} />
          <Stat label="Interacciones" values={t.interactions} last={last} />
          <Stat label="Tasa de interacción" values={rate} last={last} suffix="%" decimals={1} points />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 print:grid-cols-2">
          <section className="break-inside-avoid">
            <h2 className="mb-2 font-semibold">Seguidores por red</h2>
            <LineChart
              labels={data.months.map(shortMonth)}
              series={client.networks.map((n) => ({ key: n, label: NETWORK_LABEL[n], color: NETWORK_COLOR[n], values: data.byNetwork[n].map((r) => r.followers) }))}
              height={200}
            />
          </section>
          <section className="break-inside-avoid">
            <h2 className="mb-2 font-semibold">Alcance total</h2>
            <ColumnChart labels={data.months.map(shortMonth)} values={t.reach} highlight={last} label="alcance" height={200} />
          </section>
        </div>

        <section className="mt-8 break-inside-avoid">
          <h2 className="mb-3 font-semibold">
            Lo más destacado del mes <span className="font-normal text-muted">· {data.publishedCount} publicaciones</span>
          </h2>
          {data.top.length === 0 ? (
            <p className="text-[14px] text-muted">Sin publicaciones con resultados cargados este mes.</p>
          ) : (
            <ol className="grid gap-3 sm:grid-cols-3 print:grid-cols-3">
              {data.top.slice(0, 3).map((p, i) => (
                <li key={p.id} className="rounded-2xl border border-line p-3">
                  <div className="relative">
                    <Thumb media={p.thumb} format={p.format} className="aspect-[4/5] w-full" rounded="rounded-xl" badge={false} />
                    <span className="absolute left-2 top-2 grid size-6 place-items-center rounded-full bg-inverse text-[12px] font-bold text-inverse-ink">
                      {i + 1}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-[14px] font-semibold">{p.title}</p>
                  <p className="flex items-center gap-2 text-[12px] text-muted">
                    {formatDayShort(p.date)} <FormatTag format={p.format} />
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-1 text-[12.5px] tabular-nums">
                    <dt className="text-muted">Alcance</dt>
                    <dd className="text-right font-semibold">{p.metrics.reach.toLocaleString("es-AR")}</dd>
                    <dt className="text-muted">Interacciones</dt>
                    <dd className="text-right font-semibold">{p.interactions.toLocaleString("es-AR")}</dd>
                    <dt className="text-muted">Guardados</dt>
                    <dd className="text-right font-semibold">{p.metrics.saves.toLocaleString("es-AR")}</dd>
                  </dl>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-8">
          <h2 className="font-semibold">Detalle por red</h2>
          <DataTable data={data} networks={client.networks} />
        </section>
      </article>
    </div>
  );
}
