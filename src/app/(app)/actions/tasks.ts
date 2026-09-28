"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertClientAccess, newId, requireUser } from "@/lib/auth";
import type { TaskStatus } from "@/lib/db/schema";

const STATUSES: TaskStatus[] = ["todo", "doing", "review", "done"];

function ownTask(workspaceId: string, id: string) {
  const task = db
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.workspaceId, workspaceId)))
    .get();
  if (!task) throw new Error("Tarea no encontrada");
  return task;
}

export async function createTask(clientId: string, status: TaskStatus, title: string) {
  const user = await requireUser();
  assertClientAccess(user.workspaceId, clientId);
  const text = title.trim().slice(0, 200);
  if (!text || !STATUSES.includes(status)) return null;
  const top = db
    .select({ p: max(schema.tasks.position) })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.clientId, clientId), eq(schema.tasks.status, status)))
    .get();
  const now = Date.now();
  const task = {
    id: newId(),
    workspaceId: user.workspaceId,
    clientId,
    title: text,
    description: "",
    status,
    priority: "normal" as const,
    dueDate: null,
    assigneeId: user.id,
    postId: null,
    position: (top?.p ?? 0) + 1,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(schema.tasks).values(task).run();
  revalidatePath("/tareas");
  return task;
}

export type TaskPatch = Partial<{
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "normal" | "high";
  dueDate: string | null;
  assigneeId: string | null;
  postId: string | null;
  position: number;
}>;

export async function updateTask(id: string, patch: TaskPatch) {
  const user = await requireUser();
  const task = ownTask(user.workspaceId, id);
  const clean: TaskPatch = {};
  if (patch.title !== undefined) clean.title = patch.title.trim().slice(0, 200) || task.title;
  if (patch.description !== undefined) clean.description = patch.description.slice(0, 4000);
  if (patch.status && STATUSES.includes(patch.status)) clean.status = patch.status;
  if (patch.priority && ["low", "normal", "high"].includes(patch.priority)) clean.priority = patch.priority;
  if (patch.dueDate !== undefined) clean.dueDate = patch.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(patch.dueDate) ? patch.dueDate : null;
  if (patch.position !== undefined && Number.isFinite(patch.position)) clean.position = patch.position;
  if (patch.assigneeId !== undefined) {
    const ok =
      patch.assigneeId &&
      db
        .select({ id: schema.team.id })
        .from(schema.team)
        .where(and(eq(schema.team.id, patch.assigneeId), eq(schema.team.workspaceId, user.workspaceId)))
        .get();
    clean.assigneeId = ok ? patch.assigneeId : null;
  }
  if (patch.postId !== undefined) {
    const ok =
      patch.postId &&
      db
        .select({ id: schema.posts.id })
        .from(schema.posts)
        .where(and(eq(schema.posts.id, patch.postId), eq(schema.posts.clientId, task.clientId)))
        .get();
    clean.postId = ok ? patch.postId : null;
  }
  db.update(schema.tasks)
    .set({ ...clean, updatedAt: Date.now() })
    .where(eq(schema.tasks.id, id))
    .run();
  revalidatePath("/tareas");
}

export async function deleteTask(id: string) {
  const user = await requireUser();
  ownTask(user.workspaceId, id);
  db.delete(schema.tasks).where(eq(schema.tasks.id, id)).run();
  revalidatePath("/tareas");
}
