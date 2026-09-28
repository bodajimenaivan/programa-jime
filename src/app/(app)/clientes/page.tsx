import type { Metadata } from "next";
import { and, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getContext } from "@/lib/auth";
import { ClientsView } from "./clients-view";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage(props: PageProps<"/clientes">) {
  const { clients, client } = await getContext();
  const sp = await props.searchParams;

  const counts = clients.length
    ? db
        .select({ clientId: schema.posts.clientId, status: schema.posts.status, n: sql<number>`count(*)` })
        .from(schema.posts)
        .where(
          and(
            inArray(
              schema.posts.clientId,
              clients.map((c) => c.id),
            ),
            inArray(schema.posts.status, ["review", "changes", "approved"]),
          ),
        )
        .groupBy(schema.posts.clientId, schema.posts.status)
        .all()
    : [];

  const upcoming = clients.length
    ? db
        .select({ clientId: schema.posts.clientId, n: sql<number>`count(*)` })
        .from(schema.posts)
        .where(
          inArray(
            schema.posts.clientId,
            clients.map((c) => c.id),
          ),
        )
        .groupBy(schema.posts.clientId)
        .all()
    : [];

  return (
    <ClientsView
      activeId={client?.id ?? null}
      startAdding={sp.nuevo === "1" || clients.length === 0}
      clients={clients.map((c) => {
        const by = (s: string) => counts.find((x) => x.clientId === c.id && x.status === s)?.n ?? 0;
        return {
          id: c.id,
          name: c.name,
          handle: c.handle,
          color: c.color,
          avatarId: c.avatarId,
          networks: c.networks,
          shareToken: c.shareToken,
          review: by("review"),
          changes: by("changes"),
          approved: by("approved"),
          total: upcoming.find((x) => x.clientId === c.id)?.n ?? 0,
        };
      })}
    />
  );
}
