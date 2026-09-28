"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId, requireUser } from "@/lib/auth";
import { SWATCHES } from "@/lib/constants";

export type MemberInput = { id?: string; name: string; role: string; color: string; email: string; phone: string };

export async function saveMember(input: MemberInput): Promise<{ id: string } | { error: string }> {
  const user = await requireUser();
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Poné el nombre." };
  const values = {
    name,
    role: input.role.trim().slice(0, 60),
    color: /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : SWATCHES[0],
    email: input.email.trim().slice(0, 120),
    phone: input.phone.trim().slice(0, 40),
  };
  if (input.id) {
    const own = db
      .select()
      .from(schema.team)
      .where(and(eq(schema.team.id, input.id), eq(schema.team.workspaceId, user.workspaceId)))
      .get();
    if (!own) return { error: "No encontramos a esa persona." };
    db.update(schema.team).set(values).where(eq(schema.team.id, input.id)).run();
    // Si es una cuenta con acceso, el nombre y el color se reflejan también ahí.
    if (own.userId) db.update(schema.users).set({ name: values.name, color: values.color }).where(eq(schema.users.id, own.userId)).run();
    revalidatePath("/", "layout");
    return { id: input.id };
  }
  const id = newId();
  db.insert(schema.team)
    .values({ id, workspaceId: user.workspaceId, userId: null, ...values, createdAt: Date.now() })
    .run();
  revalidatePath("/", "layout");
  return { id };
}

export async function deleteMember(id: string) {
  const user = await requireUser();
  const own = db
    .select()
    .from(schema.team)
    .where(and(eq(schema.team.id, id), eq(schema.team.workspaceId, user.workspaceId)))
    .get();
  if (!own || own.userId) return; // la cuenta principal no se borra desde acá
  db.delete(schema.team).where(eq(schema.team.id, id)).run();
  db.update(schema.tasks).set({ assigneeId: null }).where(eq(schema.tasks.assigneeId, id)).run();
  db.update(schema.posts).set({ assigneeId: null }).where(eq(schema.posts.assigneeId, id)).run();
  revalidatePath("/", "layout");
}
