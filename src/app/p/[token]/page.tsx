import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { portalPosts } from "@/lib/queries";
import { todayIn } from "@/lib/dates";
import { Portal } from "./portal";

async function load(token: string) {
  const client = db.select().from(schema.clients).where(eq(schema.clients.shareToken, token)).get();
  if (!client || client.archivedAt) return null;
  const workspace = db.select().from(schema.workspaces).where(eq(schema.workspaces.id, client.workspaceId)).get()!;
  return { client, workspace };
}

export async function generateMetadata(props: PageProps<"/p/[token]">): Promise<Metadata> {
  const data = await load((await props.params).token);
  return {
    title: data ? `Contenido de ${data.client.name}` : "Link no válido",
    robots: { index: false, follow: false },
  };
}

export default async function PortalPage(props: PageProps<"/p/[token]">) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  const data = await load(token);
  if (!data) notFound();
  const { client, workspace } = data;
  const items = portalPosts(client.id, token);

  return (
    <Portal
      token={token}
      focus={typeof sp.pieza === "string" ? sp.pieza : null}
      initialView={typeof sp.vista === "string" ? sp.vista : null}
      initialMonth={typeof sp.mes === "string" ? sp.mes : null}
      today={todayIn(workspace.timezone)}
      agency={workspace.name}
      client={{ name: client.name, handle: client.handle, color: client.color, avatarId: client.avatarId }}
      items={items.map(({ post, media, comments }) => ({
        id: post.id,
        title: post.title,
        caption: post.caption,
        format: post.format,
        networks: post.networks,
        status: post.status,
        date: post.date,
        time: post.time,
        media,
        comments,
      }))}
    />
  );
}
