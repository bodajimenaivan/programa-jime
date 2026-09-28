"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertClientAccess, newId, requireUser } from "@/lib/auth";
import { EVENT_ORDER } from "@/lib/constants";
import type { EventType } from "@/lib/db/schema";

export type EventInput = {
  id?: string;
  clientId: string | null;
  type: EventType;
  title: string;
  date: string;
  time: string | null;
  notes: string;
  people?: string[];
};

export async function saveEvent(input: EventInput): Promise<{ id: string } | { error: string }> {
  const user = await requireUser();
  const title = input.title.trim().slice(0, 160);
  if (!title) return { error: "Poné un nombre para el evento." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Elegí una fecha." };
  if (input.time && !/^\d{2}:\d{2}$/.test(input.time)) return { error: "La hora no es válida." };
  if (!EVENT_ORDER.includes(input.type)) return { error: "Tipo inválido." };
  if (input.clientId) assertClientAccess(user.workspaceId, input.clientId);
  const members = db.select({ id: schema.team.id }).from(schema.team).where(eq(schema.team.workspaceId, user.workspaceId)).all();
  const people = (input.people ?? []).filter((p) => members.some((m) => m.id === p));
  const values = {
    people,
    clientId: input.clientId || null,
    type: input.type,
    title,
    date: input.date,
    time: input.time || null,
    notes: input.notes.slice(0, 4000),
  };
  let id = input.id;
  if (id) {
    const own = db
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(and(eq(schema.events.id, id), eq(schema.events.workspaceId, user.workspaceId)))
      .get();
    if (!own) return { error: "Evento no encontrado." };
    db.update(schema.events).set(values).where(eq(schema.events.id, id)).run();
  } else {
    id = newId();
    db.insert(schema.events)
      .values({ id, workspaceId: user.workspaceId, ...values, createdBy: user.id, createdAt: Date.now() })
      .run();
  }
  revalidatePath("/calendario");
  return { id };
}

export async function deleteEvent(id: string) {
  const user = await requireUser();
  db.delete(schema.events)
    .where(and(eq(schema.events.id, id), eq(schema.events.workspaceId, user.workspaceId)))
    .run();
  revalidatePath("/calendario");
}
