import type { Metadata } from "next";
import { requireClient } from "@/lib/auth";
import { loadHashtagStats, loadMetrics } from "@/lib/metrics";
import { monthKey, todayIn } from "@/lib/dates";
import type { Network } from "@/lib/db/schema";
import { MetricsView } from "./metrics-view";

export const metadata: Metadata = { title: "Métricas" };

export default async function MetricsPage(props: PageProps<"/metricas">) {
  const { client, workspace } = await requireClient();
  const sp = await props.searchParams;
  const current = monthKey(todayIn(workspace.timezone));
  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : current;
  const red = typeof sp.red === "string" && client.networks.includes(sp.red as Network) ? (sp.red as Network) : null;
  const networks = red ? [red] : client.networks;
  const data = loadMetrics(client.id, month, networks);
  const forForm = loadMetrics(client.id, month, client.networks, 1);

  return (
    <MetricsView
      key={client.id}
      clientId={client.id}
      clientName={client.name}
      clientNetworks={client.networks}
      month={month}
      current={current}
      red={red}
      data={data}
      formInitial={client.networks.map((n) => ({ network: n, ...forForm.byNetwork[n][0] }))}
      hashtags={loadHashtagStats(client.id, month)}
    />
  );
}
