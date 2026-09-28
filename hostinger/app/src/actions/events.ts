import type { EventType } from "@/lib/db/schema";
import { mutate } from "../api";

export type EventInput = {
  id?: string;
  clientId: string | null;
  type: EventType;
  title: string;
  date: string;
  time: string | null;
  notes: string;
};

export async function saveEvent(input: EventInput): Promise<{ id: string } | { error: string }> {
  try {
    return await mutate("saveEvent", [input]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
}

export const deleteEvent = (id: string) => mutate<void>("deleteEvent", [id]);
