import type { Metadata } from "next";
import { getContext } from "@/lib/auth";
import { teamAgenda, teamList } from "@/lib/queries";
import { todayIn } from "@/lib/dates";
import { TeamView } from "./team-view";

export const metadata: Metadata = { title: "Mi equipo" };

export default async function TeamPage() {
  const { user, workspace, clients } = await getContext();
  const today = todayIn(workspace.timezone);
  return (
    <TeamView
      today={today}
      members={teamList(user.workspaceId)}
      agenda={teamAgenda(user.workspaceId, today)}
      clients={clients.map((c) => ({ id: c.id, name: c.name, handle: c.handle, color: c.color, avatarId: c.avatarId }))}
    />
  );
}
