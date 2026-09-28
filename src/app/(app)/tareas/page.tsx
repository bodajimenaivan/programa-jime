import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { teamList } from "@/lib/queries";
import { Board } from "./board";

export const metadata: Metadata = { title: "Tareas" };

export default async function TasksPage() {
  const { client, workspace, user } = await requireClient();
  const tasks = db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.clientId, client.id))
    .orderBy(asc(schema.tasks.position))
    .all();
  const people = teamList(user.workspaceId).map((m) => ({ id: m.id, name: m.name, color: m.color }));
  const posts = db
    .select({ id: schema.posts.id, title: schema.posts.title, date: schema.posts.date })
    .from(schema.posts)
    .where(eq(schema.posts.clientId, client.id))
    .orderBy(desc(schema.posts.date))
    .limit(80)
    .all();

  return <Board key={client.id} clientId={client.id} clientName={client.name} tasks={tasks} people={people} posts={posts} today={todayIn(workspace.timezone)} />;
}
