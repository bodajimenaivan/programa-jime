import type { Task, TaskStatus } from "@/lib/db/schema";
import { mutate } from "../api";

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

export const createTask = (clientId: string, status: TaskStatus, title: string) => mutate<Task | null>("createTask", [clientId, status, title]);
export const updateTask = (id: string, patch: TaskPatch) => mutate<void>("updateTask", [id, patch]);
export const deleteTask = (id: string) => mutate<void>("deleteTask", [id]);
