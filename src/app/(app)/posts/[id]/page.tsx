import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContext, requireClient } from "@/lib/auth";
import { getPostFull, teamList } from "@/lib/queries";
import { todayIn } from "@/lib/dates";
import { PostEditor } from "./post-editor";

export const metadata: Metadata = { title: "Pieza" };

export default async function PostPage(props: PageProps<"/posts/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;

  if (id === "nuevo") {
    const { client, clients, workspace } = await requireClient();
    const fecha = typeof sp.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : todayIn(workspace.timezone);
    return (
      <PostEditor
        key="nuevo"
        client={client}
        clients={clients}
        team={teamList(workspace.id)}
        initial={{
          format: "post",
          networks: client.networks.includes("instagram") ? ["instagram"] : [client.networks[0]],
          date: fecha,
          time: null,
          title: "",
          caption: "",
          status: "draft",
          notes: "",
          postMetrics: null,
        }}
        media={[]}
        comments={[]}
      />
    );
  }

  const { user, clients } = await getContext();
  const full = getPostFull(id, user.workspaceId);
  if (!full) notFound();
  const client = clients.find((c) => c.id === full.post.clientId);
  if (!client) notFound();

  return (
    <PostEditor
      key={full.post.id}
      id={full.post.id}
      client={client}
      clients={clients}
      team={teamList(user.workspaceId)}
      initial={full.post}
      media={full.media}
      comments={full.comments}
    />
  );
}
