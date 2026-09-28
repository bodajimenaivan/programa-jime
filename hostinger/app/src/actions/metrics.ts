import type { Network } from "@/lib/db/schema";
import { mutate } from "../api";

export type MetricInput = {
  network: Network;
  followers: number;
  reach: number;
  impressions: number;
  interactions: number;
  profileVisits: number;
};

export const saveMonthMetrics = (clientId: string, month: string, rows: MetricInput[]) =>
  mutate<void>("saveMonthMetrics", [clientId, month, rows]);
