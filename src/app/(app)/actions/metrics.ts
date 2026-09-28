"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertClientAccess, newId, requireUser } from "@/lib/auth";
import { NETWORK_ORDER } from "@/lib/constants";
import type { Network } from "@/lib/db/schema";

export type MetricInput = {
  network: Network;
  followers: number;
  reach: number;
  impressions: number;
  interactions: number;
  profileVisits: number;
};

const n = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

export async function saveMonthMetrics(clientId: string, month: string, rows: MetricInput[]) {
  const user = await requireUser();
  assertClientAccess(user.workspaceId, clientId);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Mes inválido");
  const stmt = db.$client.prepare(
    `INSERT INTO metrics (id, client_id, network, month, followers, reach, impressions, interactions, profile_visits)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(client_id, network, month) DO UPDATE SET
       followers=excluded.followers, reach=excluded.reach, impressions=excluded.impressions,
       interactions=excluded.interactions, profile_visits=excluded.profile_visits`,
  );
  db.$client.transaction(() => {
    for (const r of rows) {
      if (!NETWORK_ORDER.includes(r.network)) continue;
      stmt.run(newId(), clientId, r.network, month, n(r.followers), n(r.reach), n(r.impressions), n(r.interactions), n(r.profileVisits));
    }
  })();
  revalidatePath("/metricas");
}
