"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, MessageCircle, RotateCcw } from "lucide-react";
import type { Comment, Network, PostFormat, PostStatus } from "@/lib/db/schema";
import type { MediaDTO } from "@/lib/queries";
import { FORMAT_LABEL } from "@/lib/constants";
import { formatDayLong, relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ClientAvatar } from "@/components/ui/avatar";
import { NetworkIcon } from "@/components/ui/network-icon";
import { Sheet } from "@/components/ui/sheet";
import { LogoMark } from "@/components/ui/logo";
import { StatusPill } from "@/components/post/bits";
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

export function Portal({
  token,
  focus,
  today,
  agency,
  client,
  items,
}: {
  token: string;
  focus: string | null;
  today: string;
  agency: string;
  client: ClientInfo;
  items: Item[];
}) {
  const pending = items.filter((i) => PENDING.includes(i.status));
  const [tab, setTab] = useState<"pending" | "all">(pending.length && !focus ? "pending" : "all");
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

  const list = tab === "pending" ? pending : items;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[560px] items-center gap-3 px-4 py-3">
          <ClientAvatar client={client} size={40} share={token} ring={pending.length > 0} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold leading-tight">{client.name}</p>
            <p className="truncate text-[12.5px] text-muted">Contenido preparado por {agency}</p>
          </div>
        </div>
        <div className="mx-auto flex max-w-[560px] gap-5 px-4">
          <TabButton on={tab === "pending"} onClick={() => setTab("pending")}>
            Para aprobar {pending.length > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-[11px] text-accent-ink">{pending.length}</span>}
          </TabButton>
          <TabButton on={tab === "all"} onClick={() => setTab("all")}>
            Calendario completo
          </TabButton>
        </div>
      </header>

      <main className="mx-auto max-w-[560px] px-4 pb-24 pt-5">
        {tab === "pending" && pending.length === 0 ? (
          <div className="card mt-6 px-6 py-12 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-[color-mix(in_oklab,var(--c-approved)_15%,transparent)] text-st-approved">
              <Check className="size-7" strokeWidth={2.5} />
            </span>
            <p className="mt-4 font-display text-[22px] font-bold">Estás al día</p>
            <p className="mt-1 text-[15px] text-muted">No hay nada esperando tu aprobación. Te avisamos cuando haya piezas nuevas.</p>
            <button className="btn-ghost btn-sm mt-5" onClick={() => setTab("all")}>
              Ver el calendario
            </button>
          </div>
        ) : (
          <>
            {tab === "pending" && (
              <p className="mb-5 text-[15px] text-ink-2">
                Hay <b>{pending.length}</b> {pending.length === 1 ? "pieza esperando" : "piezas esperando"} tu OK. Mirá cómo quedan y aprobá o
                pedí cambios.
              </p>
            )}
            <ol className="space-y-10">
              {list.map((item) => (
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
              ))}
            </ol>
          </>
        )}
        <p className="mt-14 flex items-center justify-center gap-1.5 text-[12px] text-muted">
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
  const locked = item.status === "published" || item.status === "scheduled";

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
        <StatusPill status={item.status} />
      </div>

      <PostPreview
        format={item.format}
        media={item.media.map((m) => ({ id: m.id, kind: m.kind, url: m.url, posterUrl: m.posterUrl }))}
        caption={item.caption}
        client={client}
        share={token}
        className={cn(item.format !== "post" && item.format !== "carousel" && "mx-auto max-w-[380px]")}
      />

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
