import { cookies } from "next/headers";
import { CLIENT_COOKIE, SESSION_COOKIE, getClients, userFromToken } from "@/lib/auth";
import { loadMetrics } from "@/lib/metrics";
import { NETWORK_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

function csvCell(v: string | number | null) {
  if (v === null) return "";
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const jar = await cookies();
  const user = userFromToken(jar.get(SESSION_COOKIE)?.value);
  if (!user) return new Response("No autorizado", { status: 401 });
  const clients = await getClients(user.workspaceId);
  const client = clients.find((c) => c.id === jar.get(CLIENT_COOKIE)?.value) ?? clients[0];
  if (!client) return new Response("Sin clientes", { status: 404 });

  const month = new URL(req.url).searchParams.get("mes") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("Mes inválido", { status: 400 });
  const data = loadMetrics(client.id, month, client.networks, 12);

  const lines: (string | number | null)[][] = [
    ["Mes", "Red", "Seguidores", "Alcance", "Impresiones", "Interacciones", "Visitas al perfil"],
  ];
  data.months.forEach((m, i) => {
    for (const n of client.networks) {
      const r = data.byNetwork[n][i];
      lines.push([m, NETWORK_LABEL[n], r.followers, r.reach, r.impressions, r.interactions, r.profileVisits]);
    }
  });
  lines.push([], ["Publicaciones del mes", "Fecha", "Formato", "Alcance", "Me gusta", "Comentarios", "Guardados", "Compartidos", "Reproducciones"]);
  for (const p of data.top) {
    const x = p.metrics;
    lines.push([p.title, p.date, p.format, x.reach, x.likes, x.comments, x.saves, x.shares, x.views]);
  }

  // BOM para que Excel respete los acentos.
  const body = "﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
  const slug = client.handle.replace(/[^a-z0-9._-]/gi, "");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="metricas-${slug}-${month}.csv"`,
    },
  });
}
