import type { Metadata } from "next";
import { requireClient } from "@/lib/auth";
import { feedPosts, postsInRange } from "@/lib/queries";
import { monthGrid, monthKey, todayIn } from "@/lib/dates";
import { CalendarView } from "./calendar-view";

export const metadata: Metadata = { title: "Calendario" };

export default async function CalendarPage(props: PageProps<"/calendario">) {
  const { client, workspace } = await requireClient();
  const sp = await props.searchParams;
  const today = todayIn(workspace.timezone);

  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : monthKey(today);
  const view = sp.vista === "lista" || sp.vista === "feed" ? sp.vista : "mes";
  const day = typeof sp.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : null;

  const weeks = monthGrid(month);
  const posts = postsInRange(client.id, weeks[0][0], weeks.at(-1)![6]);
  const feed = view === "feed" ? feedPosts(client.id) : [];

  return (
    <CalendarView
      key={client.id}
      month={month}
      today={today}
      view={view}
      initialDay={day}
      weeks={weeks}
      posts={posts}
      feed={feed}
      client={{ name: client.name, handle: client.handle, color: client.color, avatarId: client.avatarId }}
    />
  );
}
