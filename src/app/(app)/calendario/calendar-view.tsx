"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MessageCircle, Plus, Film, GalleryHorizontalEnd, Share2, LayoutGrid, Lock } from "lucide-react";
import type { PostStatus } from "@/lib/db/schema";
import type { EventDTO, PostCardDTO } from "@/lib/queries";
import { EVENT_LABEL, STATUS_LABEL, STATUS_ORDER } from "@/lib/constants";
import { WEEKDAYS_SHORT, formatDayLong, monthLabel, monthKey, parseISODate, relativeDay, shiftMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { FormatIcon, FormatTag, StatusDot, StatusPill, STATUS_VAR, Thumb } from "@/components/post/bits";
import { NetworkIcon } from "@/components/ui/network-icon";
import { ClientAvatar } from "@/components/ui/avatar";
import { movePost } from "../actions/posts";
import { switchClient } from "../actions/clients";
import { EventIcon, EventSheet } from "@/components/calendar/event-sheet";
import { useToast } from "@/components/ui/toast";
import { shareLink } from "@/lib/share";
import { absUrl } from "@/lib/base";

type View = "mes" | "lista" | "feed";
type ClientInfo = { name: string; handle: string; color: string; avatarId: string | null };
type ClientChip = ClientInfo & { id: string };
type Ctx = { all: boolean; clientsById: Map<string, ClientChip>; onEvent: (e: EventDTO | null, date: string) => void };

export function CalendarView({
  month,
  today,
  view,
  initialDay,
  weeks,
  posts: initialPosts,
  events = [],
  feed,
  client,
  shareToken,
  all = false,
  clients = [],
  activeClientId,
}: {
  shareToken?: string;
  events?: EventDTO[];
  /** Vista con todos los clientes juntos. */
  all?: boolean;
  clients?: ClientChip[];
  activeClientId?: string;
  month: string;
  today: string;
  view: View;
  initialDay: string | null;
  weeks: string[][];
  posts: PostCardDTO[];
  feed: PostCardDTO[];
  client: ClientInfo;
}) {
  const router = useRouter();
  const [toast, showToast] = useToast();
  const [switching, startSwitch] = useTransition();
  const [eventSheet, setEventSheet] = useState<{ event: EventDTO | null; date: string } | null>(null);
  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const ctx: Ctx = { all, clientsById, onEvent: (event, date) => setEventSheet({ event, date }) };
  const [posts, setPosts] = useState(initialPosts);
  useEffect(() => setPosts(initialPosts), [initialPosts]);

  const defaultDay = monthKey(today) === month ? today : `${month}-01`;
  const [selected, setSelected] = useState(initialDay && monthKey(initialDay) === month ? initialDay : defaultDay);
  useEffect(() => {
    setSelected(initialDay && monthKey(initialDay) === month ? initialDay : defaultDay);
  }, [month, initialDay, defaultDay]);

  const byDay = useMemo(() => {
    const map = new Map<string, PostCardDTO[]>();
    for (const p of posts) map.set(p.date, [...(map.get(p.date) ?? []), p]);
    return map;
  }, [posts]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventDTO[]>();
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [events]);

  const inMonth = posts.filter((p) => monthKey(p.date) === month);
  const counts = STATUS_ORDER.map((s) => [s, inMonth.filter((p) => p.status === s).length] as const).filter(([, n]) => n > 0);

  const href = (m: string, v: View = view, todos = all) => `/calendario?mes=${m}${v !== "mes" ? `&vista=${v}` : ""}${todos ? "&ver=todos" : ""}`;
  const [year, monthName] = [month.slice(0, 4), monthLabel(month).split(" ")[0]];

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-12 lg:px-8">
      {/* Cabecera */}
      <div className="flex items-end justify-between gap-3 pb-4 pt-6 lg:pt-8">
        <h1 className="font-display text-[30px] font-bold capitalize leading-none tracking-[-0.02em] lg:text-[38px]">
          {view === "feed" ? "Feed" : monthName} {view !== "feed" && <span className="text-muted">{year}</span>}
        </h1>
        {view !== "feed" && (
          <div className="flex items-center gap-1">
            <Link href={href(shiftMonth(month, -1))} className="grid size-10 place-items-center rounded-full border border-line bg-surface" aria-label="Mes anterior">
              <ChevronLeft className="size-[18px]" />
            </Link>
            <Link href={href(monthKey(today))} className="h-10 rounded-full border border-line bg-surface px-3.5 text-[14px] font-semibold leading-[38px]">
              Hoy
            </Link>
            <Link href={href(shiftMonth(month, 1))} className="grid size-10 place-items-center rounded-full border border-line bg-surface" aria-label="Mes siguiente">
              <ChevronRight className="size-[18px]" />
            </Link>
          </div>
        )}
      </div>

      {clients.length > 1 && (
        <div className={cn("no-scrollbar -mx-5 mb-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0", switching && "opacity-60")}>
          <Link href={href(month, view === "feed" ? "mes" : view, true)} className="chip" data-on={all}>
            <LayoutGrid className="size-4" /> Todos los clientes
          </Link>
          {clients.map((c) => (
            <button
              key={c.id}
              className="chip pl-1.5"
              data-on={!all && c.id === activeClientId}
              onClick={() =>
                startSwitch(async () => {
                  if (c.id !== activeClientId) await switchClient(c.id);
                  router.push(href(month, view, false));
                  router.refresh();
                })
              }
            >
              <ClientAvatar client={c} size={22} /> {c.handle}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-4 pb-6">
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
        <div className="inline-flex rounded-full bg-sunken p-1">
          {((all ? ["mes", "lista"] : ["mes", "lista", "feed"]) as View[]).map((v) => (
            <Link
              key={v}
              href={href(month, v)}
              className={cn(
                "h-8 rounded-full px-4 text-[14px] font-semibold capitalize leading-8 transition-colors",
                v === view ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted",
              )}
            >
              {v === "mes" ? "Mes" : v === "lista" ? "Lista" : "Feed"}
            </Link>
          ))}
        </div>
        {shareToken && !all && (
          <button
            className="btn-ghost btn-sm shrink-0 px-3.5"
            onClick={async () => {
              const res = await shareLink(absUrl(`/p/${shareToken}?vista=calendario&mes=${month}`), `Calendario de ${client.name}`);
              if (res === "copied") showToast("Link del calendario copiado. Mandáselo al cliente.");
            }}
          >
            <Share2 className="size-4" /> <span>Compartir</span>
          </button>
        )}
        </div>
        {view !== "feed" && counts.length > 0 && (
          <div className="no-scrollbar -mx-5 flex w-[calc(100%+40px)] gap-3.5 overflow-x-auto px-5 text-[13px] text-ink-2 sm:mx-0 sm:w-auto sm:px-0">
            <span className="shrink-0 font-semibold text-ink">{inMonth.length} {inMonth.length === 1 ? "pieza" : "piezas"}</span>
            {counts.map(([s, n]) => (
              <span key={s} className="flex shrink-0 items-center gap-1.5">
                <StatusDot status={s} /> {n} {STATUS_LABEL[s].toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      {view === "mes" && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <MonthGrid
            month={month}
            weeks={weeks}
            today={today}
            selected={selected}
            byDay={byDay}
            eventsByDay={eventsByDay}
            ctx={ctx}
            onSelect={setSelected}
            onSwipe={(dir) => router.push(href(shiftMonth(month, dir)))}
            onMove={(id, date) => setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, date } : p)))}
          />
          <DayPanel day={selected} today={today} posts={byDay.get(selected) ?? []} events={eventsByDay.get(selected) ?? []} ctx={ctx} />
        </div>
      )}

      {view === "lista" && (
        <ListView posts={inMonth} events={events.filter((e) => monthKey(e.date) === month)} today={today} month={month} ctx={ctx} />
      )}
      {view === "feed" && <FeedView posts={feed} client={client} />}
      {toast}
      <EventSheet
        open={!!eventSheet}
        onClose={() => setEventSheet(null)}
        initial={eventSheet?.event ?? null}
        date={eventSheet?.date ?? selected}
        clients={clients}
        defaultClientId={all ? null : (activeClientId ?? null)}
      />
    </div>
  );
}

/** Puntito con el color del cliente (en la vista de todos). */
function ClientDot({ id, ctx, className }: { id: string; ctx: Ctx; className?: string }) {
  const c = ctx.clientsById.get(id);
  if (!ctx.all || !c) return null;
  return <span title={c.name} className={cn("inline-block size-2.5 shrink-0 rounded-full ring-2 ring-surface", className)} style={{ background: c.color }} />;
}

/* ---------------- Mes ---------------- */

function MonthGrid({
  month,
  weeks,
  today,
  selected,
  byDay,
  eventsByDay,
  ctx,
  onSelect,
  onSwipe,
  onMove,
}: {
  month: string;
  weeks: string[][];
  today: string;
  selected: string;
  byDay: Map<string, PostCardDTO[]>;
  eventsByDay: Map<string, EventDTO[]>;
  ctx: Ctx;
  onSelect: (d: string) => void;
  onSwipe: (dir: 1 | -1) => void;
  onMove: (id: string, date: string) => void;
}) {
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [, start] = useTransition();

  return (
    <div
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        if (!touch.current) return;
        const dx = e.changedTouches[0].clientX - touch.current.x;
        const dy = e.changedTouches[0].clientY - touch.current.y;
        touch.current = null;
        if (Math.abs(dx) > 70 && Math.abs(dy) < 45) onSwipe(dx < 0 ? 1 : -1);
      }}
    >
      <div className="grid grid-cols-7 gap-1.5 pb-2 lg:gap-2">
        {WEEKDAYS_SHORT.map((d) => (
          <span key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted lg:text-left lg:pl-2">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 lg:gap-2">
        {weeks.flat().map((date) => {
          const list = byDay.get(date) ?? [];
          const evs = eventsByDay.get(date) ?? [];
          const other = monthKey(date) !== month;
          const isToday = date === today;
          const isSel = date === selected;
          const first = list[0];
          return (
            <div
              key={date}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(date)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(date)}
              onDragOver={(e) => {
                e.preventDefault();
                setDropOn(date);
              }}
              onDragLeave={() => setDropOn((d) => (d === date ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                setDropOn(null);
                const id = e.dataTransfer.getData("text/x-post");
                if (!id) return;
                onMove(id, date);
                start(() => movePost(id, date));
              }}
              className={cn(
                "group relative flex aspect-[3/4] cursor-pointer flex-col rounded-xl border p-1 text-left transition-colors lg:aspect-auto lg:min-h-[132px] lg:p-2",
                other ? "border-transparent bg-transparent" : "border-line bg-surface",
                isSel && "border-ink! shadow-[0_0_0_1px_var(--c-ink)]",
                dropOn === date && "border-accent! bg-accent-soft",
              )}
            >
              <span className="flex items-center justify-between">
                <span
                  className={cn(
                    "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[12px] font-semibold lg:h-6 lg:min-w-6 lg:text-[13px]",
                    isToday ? "bg-accent text-accent-ink" : other ? "text-muted/60" : "text-ink-2",
                  )}
                >
                  {parseISODate(date).d}
                </span>
                {evs.length > 0 && (
                  <span
                    className="grid size-5 place-items-center rounded-full bg-brand-green text-white lg:hidden"
                    title={evs.map((e) => e.title).join(" · ")}
                  >
                    <EventIcon type={evs[0].type} className="size-3" />
                  </span>
                )}
                <Link
                  href={`/posts/nuevo?fecha=${date}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hidden size-6 place-items-center rounded-full text-muted opacity-0 transition-opacity hover:bg-sunken hover:text-ink group-hover:opacity-100 lg:grid"
                  aria-label="Nueva pieza este día"
                >
                  <Plus className="size-4" />
                </Link>
              </span>

              {/* Mobile: una miniatura con el color del estado */}
              {first && (
                <span className="relative mt-1 block min-h-0 flex-1 lg:hidden">
                  <Thumb
                    media={first.thumb}
                    format={first.format}
                    rounded="rounded-md"
                    badge={false}
                    className={cn("size-full", other && "opacity-50")}
                  />
                  <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-b-md" style={{ background: STATUS_VAR[first.status] }} />
                  <ClientDot id={first.clientId} ctx={ctx} className="absolute left-0.5 top-0.5 size-2! ring-1!" />
                  {list.length > 1 && (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-inverse px-1 text-[10px] font-bold text-inverse-ink">
                      {list.length}
                    </span>
                  )}
                </span>
              )}

              {/* Desktop: lista corta, arrastrable */}
              <span className="mt-1.5 hidden flex-col gap-1 lg:flex">
                {evs.map((e) => (
                  <button
                    key={e.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      ctx.onEvent(e, date);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg bg-[color-mix(in_oklab,var(--c-brand-green)_16%,transparent)] px-1.5 py-1 text-left text-[12px] font-semibold text-ink",
                      other && "opacity-50",
                    )}
                    title={`${EVENT_LABEL[e.type]} · solo equipo`}
                  >
                    <EventIcon type={e.type} className="size-3.5 shrink-0 text-brand-green" />
                    <span className="truncate">{e.time ? `${e.time} ` : ""}{e.title}</span>
                  </button>
                ))}
                {list.slice(0, 3).map((p) => (
                  <Link
                    key={p.id}
                    href={`/posts/${p.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/x-post", p.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn("flex items-center gap-2 rounded-lg p-1 pr-1.5 hover:bg-sunken", other && "opacity-50")}
                  >
                    <span className="relative shrink-0">
                      <Thumb media={p.thumb} format={p.format} className="h-9 w-[29px]" rounded="rounded-[5px]" badge={false} />
                      <ClientDot id={p.clientId} ctx={ctx} className="absolute -left-1 -top-1" />
                    </span>
                    <span className="min-w-0 flex-1 leading-tight" title={p.title}>
                      <span className="hidden truncate text-[12.5px] font-semibold 2xl:block">{p.title}</span>
                      <span className="flex items-center gap-1 text-[12px] font-semibold text-ink-2 2xl:hidden">
                        {p.time ?? "—"}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                        <StatusDot status={p.status} className="size-1.5" />
                        <FormatIcon format={p.format} className="size-3" />
                        <span className="hidden 2xl:inline">{p.time ?? "Sin hora"}</span>
                      </span>
                    </span>
                  </Link>
                ))}
                {list.length > 3 && <span className="pl-1 text-[12px] font-semibold text-muted">+{list.length - 3} más</span>}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 hidden text-[12.5px] text-muted lg:block">Tip: arrastrá una pieza a otro día para moverla.</p>
    </div>
  );
}

function DayPanel({ day, today, posts, events, ctx }: { day: string; today: string; posts: PostCardDTO[]; events: EventDTO[]; ctx: Ctx }) {
  const rel = relativeDay(day, today);
  const empty = posts.length === 0 && events.length === 0;
  return (
    <section className="mt-9 lg:sticky lg:top-6 lg:mt-0 lg:self-start">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-[20px] font-bold first-letter:uppercase">
          {formatDayLong(day)}
          {rel && <span className="ml-2 text-[14px] font-semibold text-accent-strong">{rel}</span>}
        </h2>
      </div>
      {empty ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center">
          <p className="text-[15px] font-semibold">Día libre</p>
          <p className="mt-0.5 text-[14px] text-muted">No hay nada planificado.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href={`/posts/nuevo?fecha=${day}`} className="btn-primary btn-sm">
              <Plus className="size-4" strokeWidth={2.5} /> Pieza
            </Link>
            <button className="btn-ghost btn-sm" onClick={() => ctx.onEvent(null, day)}>
              <Lock className="size-4" /> Evento interno
            </button>
          </div>
        </div>
      ) : (
        <>
          {events.length > 0 && (
            <ul className="mb-2.5 space-y-2">
              {events.map((e) => (
                <li key={e.id}>
                  <EventRow event={e} ctx={ctx} />
                </li>
              ))}
            </ul>
          )}
          <ul className="space-y-2.5">
            {posts.map((p) => (
              <li key={p.id}>
                <PostRow post={p} ctx={ctx} />
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href={`/posts/nuevo?fecha=${day}`}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong text-[14px] font-semibold text-ink-2 hover:border-ink hover:text-ink"
            >
              <Plus className="size-4" strokeWidth={2.5} /> Pieza
            </Link>
            <button
              onClick={() => ctx.onEvent(null, day)}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong text-[14px] font-semibold text-ink-2 hover:border-ink hover:text-ink"
            >
              <Lock className="size-4" /> Evento interno
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function EventRow({ event: e, ctx }: { event: EventDTO; ctx: Ctx }) {
  const c = e.clientId ? ctx.clientsById.get(e.clientId) : null;
  return (
    <button
      onClick={() => ctx.onEvent(e, e.date)}
      className="flex w-full items-center gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--c-brand-green)_35%,transparent)] bg-[color-mix(in_oklab,var(--c-brand-green)_12%,var(--c-surface))] p-3 text-left transition-colors hover:border-brand-green"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-green text-white">
        <EventIcon type={e.type} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{e.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-2">
          {EVENT_LABEL[e.type]}
          {e.time && <span>· {e.time}</span>}
          {c && <span className="truncate">· {c.handle}</span>}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted">
        <Lock className="size-3" /> Equipo
      </span>
    </button>
  );
}

function PostRow({ post: p, ctx }: { post: PostCardDTO; ctx?: Ctx }) {
  const c = ctx?.all ? ctx.clientsById.get(p.clientId) : undefined;
  return (
    <Link href={`/posts/${p.id}`} className="card flex gap-3 p-2.5 transition-colors hover:border-line-strong active:bg-sunken/50">
      <Thumb media={p.thumb} format={p.format} className="h-[76px] w-[61px] shrink-0" rounded="rounded-[10px]" />
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          {c && (
            <p className="mb-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
              <ClientAvatar client={c} size={16} /> {c.handle}
            </p>
          )}
          <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{p.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <StatusPill status={p.status} />
          <span className="text-[12.5px] font-medium text-ink-2">{p.time ?? "Sin hora"}</span>
          <FormatTag format={p.format} />
          <span className="flex items-center gap-1 text-muted">
            {p.networks.map((n) => (
              <NetworkIcon key={n} network={n} className="size-3.5" />
            ))}
          </span>
          {p.comments > 0 && (
            <span className="flex items-center gap-1 text-[12px] text-muted">
              <MessageCircle className="size-3.5" /> {p.comments}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ---------------- Lista ---------------- */

function ListView({ posts, events, today, month, ctx }: { posts: PostCardDTO[]; events: EventDTO[]; today: string; month: string; ctx: Ctx }) {
  const [filter, setFilter] = useState<PostStatus | "all">("all");
  const shown = filter === "all" ? posts : posts.filter((p) => p.status === filter);
  const shownEvents = filter === "all" ? events : [];
  const days = [...new Set([...shown.map((p) => p.date), ...shownEvents.map((e) => e.date)])].sort();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-scrollbar -mx-5 mb-5 flex gap-2 overflow-x-auto px-5">
        <button className="chip" data-on={filter === "all"} onClick={() => setFilter("all")}>
          Todas
        </button>
        {STATUS_ORDER.map((s) => (
          <button key={s} className="chip" data-on={filter === s} onClick={() => setFilter(s)}>
            <StatusDot status={s} /> {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {days.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-5 py-12 text-center">
          <p className="font-semibold">Nada por acá en {monthLabel(month)}</p>
          <Link href={`/posts/nuevo?fecha=${month}-01`} className="btn-primary btn-sm mt-4">
            <Plus className="size-4" /> Planificar una pieza
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {days.map((d) => (
            <section key={d}>
              <h3 className={cn("mb-2 text-[13px] font-semibold first-letter:uppercase", d < today ? "text-muted" : "text-ink-2")}>
                {relativeDay(d, today) ? <span className="text-accent-strong">{relativeDay(d, today)} · </span> : null}
                {formatDayLong(d)}
              </h3>
              <ul className="space-y-2">
                {shownEvents
                  .filter((e) => e.date === d)
                  .map((e) => (
                    <li key={e.id}>
                      <EventRow event={e} ctx={ctx} />
                    </li>
                  ))}
                {shown
                  .filter((p) => p.date === d)
                  .map((p) => (
                    <li key={p.id}>
                      <PostRow post={p} ctx={ctx} />
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Feed (perfil de IG) ---------------- */

function FeedView({ posts, client }: { posts: PostCardDTO[]; client: ClientInfo }) {
  return (
    <div className="mx-auto max-w-[480px]">
      <div className="card overflow-hidden">
        <div className="flex items-center gap-4 px-4 pb-4 pt-5">
          <ClientAvatar client={client} size={72} ring />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold">{client.handle}</p>
            <p className="truncate text-[13.5px] text-muted">{client.name}</p>
            <p className="mt-1.5 text-[13px]">
              <span className="font-semibold">{posts.length}</span> publicaciones planificadas
            </p>
          </div>
        </div>
        <p className="border-t border-line bg-sunken/50 px-4 py-2 text-[12.5px] text-muted">
          Así va a quedar la grilla del perfil, de lo más nuevo a lo más viejo.
        </p>
        {posts.length === 0 ? (
          <p className="px-4 py-10 text-center text-[14px] text-muted">Todavía no hay posts, carruseles ni reels para Instagram.</p>
        ) : (
          <div className="grid grid-cols-3 gap-[2px]">
            {posts.map((p) => (
              <Link key={p.id} href={`/posts/${p.id}`} className="relative block aspect-[3/4] bg-sunken">
                <Thumb media={p.thumb} format={p.format} className="size-full" rounded="rounded-none" badge={false} />
                <span className="absolute right-1.5 top-1.5 text-white drop-shadow">
                  {p.format === "reel" ? <Film className="size-4" /> : p.format === "carousel" ? <GalleryHorizontalEnd className="size-4" /> : null}
                </span>
                {p.status !== "published" && (
                  <span className="absolute bottom-1.5 left-1.5">
                    <StatusPill status={p.status} className="h-5 bg-surface/90! px-2 text-[10.5px] backdrop-blur" />
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
