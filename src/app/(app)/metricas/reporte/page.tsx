import type { Metadata } from "next";
import { requireClient } from "@/lib/auth";
import { loadMetrics } from "@/lib/metrics";
import { monthKey, todayIn } from "@/lib/dates";
import { ReportView } from "./report-view";

export const metadata: Metadata = { title: "Reporte" };

export default async function ReportPage(props: PageProps<"/metricas/reporte">) {
  const { client, workspace } = await requireClient();
  const sp = await props.searchParams;
  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : monthKey(todayIn(workspace.timezone));
  const data = loadMetrics(client.id, month, client.networks);
  return <ReportView client={client} workspaceName={workspace.name} month={month} data={data} />;
}
