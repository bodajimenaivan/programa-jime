"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, MessageCircle, RotateCcw } from "lucide-react";
import type { Comment, Network, PostFormat, PostStatus } from "@/lib/db/schema";
import type { MediaDTO } from "@/lib/queries";
import { FORMAT_LABEL } from "@/lib/constants";
import { WEEKDAYS_SHORT, formatDayLong, monthGrid, monthKey, monthLabel, parseISODate, relativeDay, shiftMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ClientAvatar } from "@/components/ui/avatar";
import { NetworkIcon } from "@/components/ui/network-icon";
import { Sheet } from "@/components/ui/sheet";
import { LogoMark } from "@/components/ui/logo";
import { STATUS_VAR, StatusPill, Thumb } from "@/components/post/bits";
import { MediaDownloads } from "@/components/post/downloads";
import { CopyButton } from "@/components/ui/copy-button";
import { PostPreview } from "@/components/post/preview";
import { CommentList } from "@/components/post/comment-thread";
import { useToast } from "@/components/ui/toast";
import { clientFeedback } from "../actions";

type Item = {
  id: string;
  title: string;
  caption: string;
  format: PostFormat;
  networks: Network[];
  status: PostStatus;
  date: string;
  time: string | null;
  media: MediaDTO[];
  comments: Comment[];
};
type ClientInfo = { name: string; handle: string; color: string; avatarId: string | null };

const NAME_KEY = "grilla:reviewer";
const PENDING: PostStatus[] = ["review"];

type Tab = "pending" | "calendar" | "list";

export function Portal({
  token,
  focus,
  today,
  agency,
  client,
  items,
  initialView,
  initialMonth,
}: {
  token: string;
  focus: string | null;
  today: string;
  agency: string;
  client: ClientInfo;
  items: Item[];
  /** "calendario" o "lista" desde el link (?vista=). */
  initialView?: string | null;
  /** Mes a mostrar primero (?mes=AAAA-MM). */
  initialMonth?: string | null;
}) {
  const pending = items.filter((i) => PENDING.includes(i.status));
  const [tab, setTab] = useState<Tab>(() => {
    if (focus) return "list";
    if (initialView === "calendario") return "calendar";
    if (initialView === "lista") return "list";
    return pending.length ? "pending" : "calendar";
  });
  const [name, setName] = useState("");
  const [askName, setAskName] = useState<null | (() => void)>(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {}
  }, []);

  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`pieza-${focus}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus]);

  const withName = (fn: () => void) => {
    if (name) fn();
    else setAskName(() => fn);
  };

  const renderItem = (item: Item) => (
    <PortalItem
      key={item.id}
      item={item}
      token={token}
      today={today}
      client={client}
      highlight={focus === item.id}
      name={name}
      withName={withName}
      onDone={showToast}
    />
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[640px] items-center gap-3 px-5 py-3">
          <ClientAvatar client={client} size={40} share={token} ring={pending.length > 0} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold leading-tight">{client.name}</p>
            <p className="truncate text-[12.5px] text-muted">Contenido preparado por {agency}</p>
          </div>
        </div>
        <div className="no-scrollbar mx-auto flex max-w-[640px] gap-6 overflow-x-auto px-5">
          <TabButton on={tab === "pending"} onClick={() => setTab("pending")}>
            Para aprobar {pending.length > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[11px] text-accent-ink">{pending.length}</span>}
          </TabButton>
          <TabButton on={tab === "calendar"} onClick={() => setTab("calendar")}>
            Calendario
          </TabButton>
          <TabButton on={tab === "list"} onClick={() => setTab("list")}>
            Lista
          </TabButton>
        </div>
      </header>

      <main className="mx-auto max-w-[640px] px-5 pb-24 pt-6">
        {tab === "pending" &&
          (pending.length === 0 ? (
            <div className="card mt-2 px-6 py-12 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-[color-mix(in_oklab,var(--c-approved)_15%,transparent)] text-st-approved">
                <Check className="size-7" strokeWidth={2.5} />
              </span>
              <p className="mt-4 font-display text-[22px] font-bold">Estás al día</p>
              <p className="mt-1 text-[15px] text-muted">No hay nada esperando tu aprobación. Te avisamos cuando haya piezas nuevas.</p>
              <button className="btn-ghost btn-sm mt-5" onClick={() => setTab("calendar")}>
                Ver el calendario
              </button>
            </div>
          ) : (
            <>
              <p className="mb-6 text-[15px] leading-relaxed text-ink-2">
                Hay <b>{pending.length}</b> {pending.length === 1 ? "pieza esperando" : "piezas esperando"} tu OK. Mirá cómo quedan y aprobá o
                pedí cambios.
              </p>
              <ol className="space-y-12">{pending.map(renderItem)}</ol>
            </>
          ))}

        {tab === "calendar" && <PortalCalendar items={items} today={today} initialMonth={initialMonth ?? null} renderItem={renderItem} />}

        {tab === "list" &&
          (items.length === 0 ? (
            <p className="py-16 text-center text-[15px] text-muted">Todavía no hay contenido para mostrar.</p>
          ) : (
            <ol className="space-y-12">{items.map(renderItem)}</ol>
          ))}

        <p className="mt-16 flex items-center justify-center gap-1.5 text-[12px] text-muted">
          <LogoMark className="size-3.5" /> Hecho con grilla
        </p>
      </main>

      <NameSheet
        open={!!askName}
        onClose={() => setAskName(null)}
        onSave={(n) => {
          setName(n);
          try {
            localStorage.setItem(NAME_KEY, n);
          } catch {}
          const fn = askName;
          setAskName(null);
          fn?.();
        }}
      />
      {toast}
    </div>
  );
}

/** Calendario mensual de solo lectura para el cliente: mes a mes, tocás un día y ves sus piezas. */
function PortalCalendar({
  items,
  today,
  initialMonth,
  renderItem,
}: {
  items: Item[];
  today: string;
  initialMonth: string | null;
  renderItem: (item: Item) => React.ReactNode;
}) {
  const firstMonth = () => {
    if (initialMonth && /^\d{4}-\d{2}$/.test(initialMonth)) return initialMonth;
    const upcoming = items.find((i) => i.date >= today);
    return monthKey(upcoming?.date ?? today);
  };
  const [month, setMonth] = useState(firstMonth);
  const pickDay = (m: string) => {
    const inMonth = items.filter((i) => monthKey(i.date) === m);
    if (monthKey(today) === m) return inMonth.find((i) => i.date >= today)?.date ?? today;
    return inMonth[0]?.date ?? `${m}-01`;
  };
  const [selected, setSelected] = useState(() => pickDay(firstMonth()));
  const list = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = (m: string) => {
    setMonth(m);
    setSelected(pickDay(m));
    // El link queda apuntando al mes que estás mirando (sirve para reenviarlo).
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("vista", "calendario");
      u.searchParams.set("mes", m);
      u.searchParams.delete("pieza");
      window.history.replaceState(window.history.state, "", u);
    } catch {}
  };

  const byDay = new Map<string, Item[]>();
  for (const i of items) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);
  const inMonth = items.filter((i) => monthKey(i.date) === month);
  const toApprove = inMonth.filter((i) => PENDING.includes(i.status)).length;
  const dayItems = byDay.get(selected) ?? [];
  const [year, name] = [month.slice(0, 4), monthLabel(month).split(" ")[0]];

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-[28px] font-bold capitalize leading-none tracking-[-0.02em]">
          {name} <span className="text-muted">{year}</span>
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={() => go(shiftMonth(month, -1))} className="grid size-10 place-items-center rounded-full border border-line bg-surface" aria-label="Mes anterior">
            <ChevronLeft className="size-[18px]" />
          </button>
          <button onClick={() => go(monthKey(today))} className="h-10 rounded-full border border-line bg-surface px-3.5 text-[14px] font-semibold">
            Hoy
          </button>
          <button onClick={() => go(shiftMonth(month, 1))} className="grid size-10 place-items-center rounded-full border border-line bg-surface" aria-label="Mes siguiente">
            <ChevronRight className="size-[18px]" />
          </button>
        </div>
      </div>
      <p className="mb-5 mt-3 text-[14px] text-muted">
        {inMonth.length === 0
          ? "No hay contenido planificado este mes."
          : `${inMonth.length} ${inMonth.length === 1 ? "pieza" : "piezas"} este mes${toApprove ? ` · ${toApprove} para aprobar` : ""}`}
      </p>

      <div
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          touch.current = null;
          if (Math.abs(dx) > 70 && Math.abs(dy) < 45) go(shiftMonth(month, dx < 0 ? 1 : -1));
        }}
      >
        <div className="grid grid-cols-7 gap-1.5 pb-2">
          {WEEKDAYS_SHORT.map((d) => (
            <span key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {monthGrid(month)
            .flat()
            .map((date) => {
              const day = byDay.get(date) ?? [];
              const other = monthKey(date) !== month;
              const first = day[0];
              const sel = date === selected;
              return (
                <button
                  key={date}
                  onClick={() => {
                    if (other) return go(monthKey(date));
                    setSelected(date);
                    if (day.length) setTimeout(() => list.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                  }}
                  className={cn(
                    "relative flex aspect-[3/4] flex-col rounded-xl border p-1 text-left transition-colors",
                    other ? "border-transparent opacity-40" : "border-line bg-surface",
                    sel && !other && "border-ink! shadow-[0_0_0_1px_var(--c-ink)]",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-5 min-w-5 place-items-center self-start rounded-full px-1 text-[12px] font-semibold",
                      date === today ? "bg-accent text-accent-ink" : "text-ink-2",
                    )}
                  >
                    {parseISODate(date).d}
                  </span>
                  {first && (
                    <span className="relative mt-1 block min-h-0 flex-1">
                      <Thumb
                        media={first.media[0] ?? null}
                        format={first.format}
                        rounded="rounded-md"
                        badge={false}
                        className="size-full"
                      />
                      <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-b-md" style={{ background: STATUS_VAR[first.status] }} />
                      {day.length > 1 && (
                        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-inverse px-1 text-[10px] font-bold text-inverse-ink">
                          {day.length}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      <div ref={list} className="scroll-mt-28 pt-9">
        <h3 className="mb-5 font-display text-[20px] font-bold first-letter:uppercase">
          {formatDayLong(selected)}
          {relativeDay(selected, today) && <span className="ml-2 text-[14px] font-semibold text-accent">{relativeDay(selected, today)}</span>}
        </h3>
        {dayItems.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-[14.5px] text-muted">
            Nada planificado este día. Tocá otro día con miniatura.
          </p>
        ) : (
          <ol className="space-y-12">{dayItems.map((i) => renderItem(i))}</ol>
        )}
      </div>
    </div>
  );
}

function TabButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn("-mb-px flex items-center border-b-2 pb-2.5 text-[14px] font-semibold", on ? "border-ink text-ink" : "border-transparent text-muted")}
    >
      {children}
    </button>
  );
}

function PortalItem({
  item,
  token,
  today,
  client,
  highlight,
  name,
  withName,
  onDone,
}: {
  item: Item;
  token: string;
  today: string;
  client: ClientInfo;
  highlight: boolean;
  name: string;
  withName: (fn: () => void) => void;
  onDone: (msg: string) => void;
}) {
  const [mode, setMode] = useState<null | "changes" | "comment">(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  const rel = relativeDay(item.date, today);
  const draft = item.status === "draft";
  const locked = draft || item.status === "published" || item.status === "scheduled";

  useEffect(() => {
    if (mode) box.current?.focus();
  }, [mode]);

  const send = (kind: "approved" | "changes" | "comment", body: string) =>
    withName(() =>
      start(async () => {
        setError(null);
        const res = await clientFeedback(token, item.id, kind, name || localStorage.getItem(NAME_KEY) || "", body);
        if ("error" in res && res.error) {
          setError(res.error);
          return;
        }
        setMode(null);
        setText("");
        onDone(kind === "approved" ? "¡Aprobada! Gracias." : kind === "changes" ? "Listo, le avisamos al equipo." : "Comentario enviado");
      }),
    );

  return (
    <li id={`pieza-${item.id}`} className={cn("scroll-mt-32", highlight && "rounded-[26px] outline-2 outline-offset-8 outline-accent")}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {item.title && item.title !== "Sin título" && (
            <h3 className="mb-1 font-display text-[19px] font-bold leading-snug tracking-[-0.01em]">{item.title}</h3>
          )}
          <p className="text-[13px] font-semibold first-letter:uppercase text-ink-2">
            {rel && <span className="text-accent">{rel} · </span>}
            {formatDayLong(item.date)}
            {item.time && ` · ${item.time} h`}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
            {FORMAT_LABEL[item.format]}
            <span className="flex gap-1">
              {item.networks.map((n) => (
                <NetworkIcon key={n} network={n} className="size-3.5" />
              ))}
            </span>
          </p>
        </div>
        <StatusPill status={item.status} label={draft ? "En preparación" : undefined} />
      </div>

      <PostPreview
        format={item.format}
        media={item.media.map((m) => ({ id: m.id, kind: m.kind, url: m.url, posterUrl: m.posterUrl }))}
        caption={item.caption}
        client={client}
        share={token}
        className={cn(item.format !== "post" && item.format !== "carousel" && "mx-auto max-w-[380px]")}
      />

      {item.caption.trim() && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink-2">Texto de la publicación</p>
            <p className="truncate text-[12.5px] text-muted">{item.caption.replace(/\s+/g, " ")}</p>
          </div>
          <CopyButton text={item.caption} label="Copiar texto" className="shrink-0" />
        </div>
      )}

      <MediaDownloads
        className="mt-3"
        files={item.media.map((m) => ({ id: m.id, url: m.url, filename: m.filename, size: m.size, kind: m.kind }))}
      />

      {draft && mode === null && (
        <p className="mt-4 rounded-xl bg-sunken/70 px-4 py-3 text-[14px] text-ink-2">
          El equipo todavía está preparando esta pieza. Cuando esté lista para aprobar, vas a ver los botones acá. Si querés, dejale un comentario.
        </p>
      )}

      {!locked && mode === null && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className={cn("btn", item.status === "approved" ? "bg-sunken text-ink-2" : "bg-st-approved text-white")}
            disabled={pending || item.status === "approved"}
            onClick={() => send("approved", "")}
          >
            <Check className="size-[18px]" strokeWidth={2.75} /> {item.status === "approved" ? "Aprobada" : "Aprobar"}
          </button>
          <button className="btn-ghost" disabled={pending} onClick={() => setMode("changes")}>
            <RotateCcw className="size-4" /> Pedir cambios
          </button>
        </div>
      )}

      {mode && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-3">
          <p className="mb-2 text-[14px] font-semibold">{mode === "changes" ? "¿Qué te gustaría cambiar?" : "Tu comentario"}</p>
          <textarea
            ref={box}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="field resize-none"
            placeholder={mode === "changes" ? "Ej. usar otra foto, cambiar el precio, sacar el hashtag…" : "Escribí acá…"}
          />
          {error && <p className="mt-2 text-[13px] font-medium text-st-changes">{error}</p>}
          <div className="mt-2.5 flex justify-end gap-2">
            <button className="btn-ghost btn-sm" onClick={() => setMode(null)}>
              Cancelar
            </button>
            <button className="btn-primary btn-sm" disabled={pending || !text.trim()} onClick={() => send(mode, text)}>
              {pending ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </div>
      )}

      {error && !mode && <p className="mt-2 text-[13px] font-medium text-st-changes">{error}</p>}

      {item.comments.some((c) => c.kind !== "status") && (
        <div className="mt-5">
          <CommentList comments={item.comments.filter((c) => c.kind !== "status")} client={client} share={token} />
        </div>
      )}
      {mode === null && (
        <button onClick={() => setMode("comment")} className="mt-3 flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-2 hover:text-ink">
          <MessageCircle className="size-4" /> Dejar un comentario
        </button>
      )}
    </li>
  );
}

function NameSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="¿Cómo te llamás?">
      <p className="mb-4 text-[14.5px] text-muted">Así el equipo sabe quién aprobó o comentó. Lo pedimos una sola vez.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSave(value.trim());
        }}
        className="space-y-3"
      >
        <input className="field" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Tu nombre" autoFocus autoComplete="given-name" />
        <button className="btn-primary w-full" disabled={!value.trim()}>
          Continuar
        </button>
      </form>
    </Sheet>
  );
}
