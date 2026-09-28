import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getContext } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, clients, client } = await getContext();

  // Cuántas piezas volvieron con cambios pedidos por el cliente (el aro tipo "historia").
  const attention = clients.length
    ? db
        .select({ clientId: schema.posts.clientId, n: sql<number>`count(*)` })
        .from(schema.posts)
        .where(
          and(
            inArray(
              schema.posts.clientId,
              clients.map((c) => c.id),
            ),
            eq(schema.posts.status, "changes"),
          ),
        )
        .groupBy(schema.posts.clientId)
        .all()
    : [];

  return (
    <AppShell
      user={{ name: user.name, email: user.email, color: user.color }}
      workspaceName={workspace.name}
      clients={clients.map((c) => ({
        id: c.id,
        name: c.name,
        handle: c.handle,
        color: c.color,
        avatarId: c.avatarId,
        networks: c.networks,
        attention: attention.find((a) => a.clientId === c.id)?.n ?? 0,
      }))}
      activeId={client?.id ?? null}
    >
      {children}
    </AppShell>
  );
}
