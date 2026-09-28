import type { Metadata } from "next";
import { requireClient } from "@/lib/auth";
import { eventsInRange, feedPosts, postsInRange, teamList } from "@/lib/queries";
import { monthGrid, monthKey, todayIn } from "@/lib/dates";
import { CalendarView } from "./calendar-view";

export const metadata: Metadata = { title: "Calendario" };

export default async function CalendarPage(props: PageProps<"/calendario">) {
  const { client, clients, workspace } = await requireClient();
  const sp = await props.searchParams;
  const today = todayIn(workspace.timezone);

  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : monthKey(today);
  // ?ver=todos junta a todos los clientes; si no, se ve el cliente activo.
  const all = sp.ver === "todos";
  const view = sp.vista === "lista" || (sp.vista === "feed" && !all) ? sp.vista : "mes";
  const day = typeof sp.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : null;

  const weeks = monthGrid(month);
  const from = weeks[0][0];
  const to = weeks.at(-1)![6];
  const posts = postsInRange(all ? clients.map((c) => c.id) : [client.id], from, to);
  const events = eventsInRange(workspace.id, from, to, all ? null : client.id);
  const feed = view === "feed" ? feedPosts(client.id) : [];

  return (
    <CalendarView
      key={all ? "todos" : client.id}
      month={month}
      today={today}
      view={view}
      initialDay={day}
      weeks={weeks}
      posts={posts}
      events={events}
      feed={feed}
      all={all}
      activeClientId={client.id}
      clients={clients.map((c) => ({ id: c.id, name: c.name, handle: c.handle, color: c.color, avatarId: c.avatarId }))}
      client={{ name: client.name, handle: client.handle, color: client.color, avatarId: client.avatarId }}
      shareToken={client.shareToken}
      team={teamList(workspace.id)}
    />
  );
}
