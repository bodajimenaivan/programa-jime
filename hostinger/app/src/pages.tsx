// Páginas de la versión PHP: piden los datos a la API y renderizan las mismas vistas que la versión Next.
import { useEffect, useState } from "react";
import type { Client, Comment, Network, Task } from "@/lib/db/schema";
import type { MediaDTO, PostCardDTO } from "@/lib/queries";
import { monthGrid, monthKey } from "@/lib/dates";
import { shapeMetrics, monthsBack, type RawMetric, type RawPublished } from "@/lib/metrics-shape";
import { AppShell } from "@/components/shell/app-shell";
import { CalendarView } from "@/app/(app)/calendario/calendar-view";
import { PostEditor } from "@/app/(app)/posts/[id]/post-editor";
import { Board } from "@/app/(app)/tareas/board";
import { MetricsView } from "@/app/(app)/metricas/metrics-view";
import { ReportView } from "@/app/(app)/metricas/reporte/report-view";
import { ClientsView } from "@/app/(app)/clientes/clients-view";
import { Portal } from "@/app/p/[token]/portal";
import { AuthFrame } from "@/app/(auth)/auth-frame";
import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/registro/page";
import { rpc } from "./api";
import { navigate, useLocation } from "./router";
import { LoadError, Loading, ShellDataContext, useData, useShellData, useTitle, type ShellData } from "./data";

const isMonth = (v: string | null): v is string => !!v && /^\d{4}-\d{2}$/.test(v);
const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/* ---------------- Layout con sesión ---------------- */

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data, error } = useData("shell", () => rpc<ShellData>("shell"));
  if (error && !data) return <LoadError message={error} />;
  if (!data) return <Loading />;
  return (
    <ShellDataContext.Provider value={data}>
      <AppShell user={data.user} workspaceName={data.workspaceName} clients={data.clients} activeId={data.activeId}>
        {children}
      </AppShell>
    </ShellDataContext.Provider>
  );
}

/* ---------------- Calendario ---------------- */

export function CalendarPage() {
  useTitle("Calendario");
  const shell = useShellData();
  const { search } = useLocation();
  const today = shell.today;
  const month = isMonth(search.get("mes")) ? search.get("mes")! : monthKey(today);
  const v = search.get("vista");
  const view = v === "lista" || v === "feed" ? v : "mes";
  const day = isDay(search.get("dia")) ? search.get("dia") : null;
  const weeks = monthGrid(month);
  const { data, error } = useData(`cal:${month}:${view}`, () =>
    rpc<{ clientId: string; posts: PostCardDTO[]; feed: PostCardDTO[] }>("calendarData", [weeks[0][0], weeks.at(-1)![6], view === "feed"]),
  );
  if (error && !data) return <LoadError message={error} />;
  if (!data || !shell.activeClient) return <Loading />;
  const c = shell.activeClient;
  return (
    <CalendarView
      key={data.clientId}
      month={month}
      today={today}
      view={view}
      initialDay={day}
      weeks={weeks}
      posts={data.posts}
      feed={data.feed}
      client={{ name: c.name, handle: c.handle, color: c.color, avatarId: c.avatarId }}
    />
  );
}

/* ---------------- Pieza ---------------- */

type PostPayload = {
  id?: string;
  notFound?: boolean;
  client: Client;
  initial: React.ComponentProps<typeof PostEditor>["initial"];
  media: MediaDTO[];
  comments: Comment[];
};

export function PostPage({ id }: { id: string }) {
  const { search } = useLocation();
  const fecha = search.get("fecha") ?? "";
  useTitle(id === "nuevo" ? "Nueva pieza" : "Pieza");
  const { data, error } = useData(`post:${id}:${id === "nuevo" ? fecha : ""}`, () => rpc<PostPayload>("postPage", [id, fecha]));
  if (error && !data) return <LoadError message={error} />;
  if (!data) return <Loading />;
  if (data.notFound) return <NotFound />;
  return <PostEditor key={data.id ?? "nuevo"} id={data.id} client={data.client} initial={data.initial} media={data.media} comments={data.comments} />;
}

/* ---------------- Tareas ---------------- */

export function TasksPage() {
  useTitle("Tareas");
  const { data, error } = useData("tasks", () =>
    rpc<{
      clientId: string;
      clientName: string;
      today: string;
      tasks: Task[];
      people: { id: string; name: string; color: string }[];
      posts: { id: string; title: string; date: string }[];
    }>("tasksPage"),
  );
  if (error && !data) return <LoadError message={error} />;
  if (!data) return <Loading />;
  return <Board key={data.clientId} {...data} />;
}

/* ---------------- Métricas ---------------- */

type MetricsPayload = {
  client: Client;
  workspaceName: string;
  today: string;
  rows: RawMetric[];
  published: RawPublished[];
};

function useMetrics(month: string) {
  return useData(`metrics:${month}`, () => rpc<MetricsPayload>("metricsData", [monthsBack(month, 6)[0], month]));
}

export function MetricsPage() {
  useTitle("Métricas");
  const shell = useShellData();
  const { search } = useLocation();
  const current = monthKey(shell.today);
  const month = isMonth(search.get("mes")) ? search.get("mes")! : current;
  const { data, error } = useMetrics(month);
  if (error && !data) return <LoadError message={error} />;
  if (!data) return <Loading />;
  const nets = data.client.networks;
  const r = search.get("red") as Network | null;
  const red = r && nets.includes(r) ? r : null;
  const shaped = shapeMetrics(month, red ? [red] : nets, data.rows, data.published);
  const single = shapeMetrics(month, nets, data.rows, data.published, 1);
  return (
    <MetricsView
      key={data.client.id}
      clientId={data.client.id}
      clientName={data.client.name}
      clientNetworks={nets}
      month={month}
      current={current}
      red={red}
      data={shaped}
      formInitial={nets.map((n) => ({ network: n, ...single.byNetwork[n][0] }))}
    />
  );
}

export function ReportPage() {
  useTitle("Reporte");
  const shell = useShellData();
  const { search } = useLocation();
  const month = isMonth(search.get("mes")) ? search.get("mes")! : monthKey(shell.today);
  const { data, error } = useMetrics(month);
  if (error && !data) return <LoadError message={error} />;
  if (!data) return <Loading />;
  return (
    <ReportView
      client={data.client}
      workspaceName={data.workspaceName}
      month={month}
      data={shapeMetrics(month, data.client.networks, data.rows, data.published)}
    />
  );
}

/* ---------------- Clientes ---------------- */

export function ClientsPage() {
  useTitle("Clientes");
  const { search } = useLocation();
  const { data, error } = useData("clients", () =>
    rpc<{ activeId: string | null; clients: React.ComponentProps<typeof ClientsView>["clients"] }>("clientsPage"),
  );
  if (error && !data) return <LoadError message={error} />;
  if (!data) return <Loading />;
  return <ClientsView activeId={data.activeId} startAdding={search.get("nuevo") === "1" || data.clients.length === 0} clients={data.clients} />;
}

/* ---------------- Link del cliente ---------------- */

export function PortalPage({ token }: { token: string }) {
  const { search } = useLocation();
  const { data, error } = useData(`portal:${token}`, () => rpc<(React.ComponentProps<typeof Portal> & { notFound?: boolean }) | { notFound: true }>("portalPage", [token]));
  useTitle(data && !("notFound" in data && data.notFound) && "client" in data ? `Contenido de ${data.client.name}` : "Contenido");
  if (error && !data) return <LoadError message={error} />;
  if (!data) return <Loading />;
  if ("notFound" in data && data.notFound) {
    return (
      <div className="mx-auto mt-24 max-w-sm px-6 text-center">
        <p className="font-display text-[24px] font-bold">Este link ya no funciona</p>
        <p className="mt-1 text-[15px] text-muted">Pedile uno nuevo a quien te lo mandó.</p>
      </div>
    );
  }
  const p = data as React.ComponentProps<typeof Portal>;
  return <Portal token={token} focus={search.get("pieza")} today={p.today} agency={p.agency} client={p.client} items={p.items} />;
}

/* ---------------- Login y registro ---------------- */

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  useTitle(mode === "login" ? "Entrar" : "Crear cuenta");
  const [state, setState] = useState<"checking" | "ready" | "closed">("checking");

  useEffect(() => {
    let alive = true;
    Promise.all([rpc<{ id: string } | null>("me"), rpc<{ needsSetup: boolean }>("setupState")])
      .then(([me, setup]) => {
        if (!alive) return;
        if (me) return navigate("/calendario", { replace: true });
        if (mode === "login" && setup.needsSetup) return navigate("/registro", { replace: true });
        setState(mode === "register" && !setup.needsSetup ? "closed" : "ready");
      })
      .catch(() => alive && setState("ready"));
    return () => {
      alive = false;
    };
  }, [mode]);

  if (state === "checking") return <Loading />;
  return (
    <AuthFrame>
      {state === "closed" ? (
        <div>
          <h1 className="font-display text-[32px] font-bold leading-tight tracking-[-0.02em]">Registro cerrado</h1>
          <p className="mb-8 mt-1.5 text-[15px] text-muted">Esta grilla ya tiene su cuenta principal. Si trabajás acá, entrá con tu email.</p>
          <a href="login" onClick={(e) => (e.preventDefault(), navigate("/login"))} className="btn-primary w-full">
            Ir a entrar
          </a>
        </div>
      ) : mode === "login" ? (
        <LoginPage />
      ) : (
        <RegisterPage />
      )}
    </AuthFrame>
  );
}

export function NotFound() {
  useTitle("No encontrado");
  return (
    <div className="mx-auto mt-24 max-w-sm px-6 text-center">
      <p className="font-display text-[26px] font-bold">No encontramos esta página</p>
      <button className="btn-primary btn-sm mt-5" onClick={() => navigate("/calendario")}>
        Ir al calendario
      </button>
    </div>
  );
}
