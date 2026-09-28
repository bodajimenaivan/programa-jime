"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Clapperboard, Lock, PackageCheck, Trash2, Users } from "lucide-react";
import type { EventType } from "@/lib/db/schema";
import type { EventDTO } from "@/lib/queries";
import { EVENT_LABEL, EVENT_ORDER } from "@/lib/constants";
import { Sheet } from "@/components/ui/sheet";
import { ClientAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { deleteEvent, saveEvent } from "@/app/(app)/actions/events";

export type EventClient = { id: string; name: string; handle: string; color: string; avatarId: string | null };

export function EventIcon({ type, className }: { type: EventType; className?: string }) {
  const cls = cn("size-4", className);
  if (type === "shoot") return <Clapperboard className={cls} />;
  if (type === "meeting") return <Users className={cls} />;
  if (type === "delivery") return <PackageCheck className={cls} />;
  return <CalendarClock className={cls} />;
}

/** Crear o editar un evento interno (rodaje, reunión, entrega). Solo lo ve el equipo. */
export function EventSheet({
  open,
  onClose,
  initial,
  date,
  clients,
  defaultClientId,
}: {
  open: boolean;
  onClose: () => void;
  initial: EventDTO | null;
  date: string;
  clients: EventClient[];
  defaultClientId: string | null;
}) {
  const router = useRouter();
  const [type, setType] = useState<EventType>("shoot");
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(date);
  const [time, setTime] = useState("");
  const [clientId, setClientId] = useState<string | null>(defaultClientId);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    setType(initial?.type ?? "shoot");
    setTitle(initial?.title ?? "");
    setDay(initial?.date ?? date);
    setTime(initial?.time ?? "");
    setClientId(initial ? initial.clientId : defaultClientId);
    setNotes(initial?.notes ?? "");
    setError(null);
  }, [open, initial, date, defaultClientId]);

  const save = () =>
    start(async () => {
      const res = await saveEvent({ id: initial?.id, type, title, date: day, time: time || null, clientId, notes });
      if ("error" in res) return setError(res.error);
      router.refresh();
      onClose();
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? "Evento interno" : "Nuevo evento interno"}
      footer={
        <div className="flex items-center gap-2">
          {initial && (
            <button
              className="grid size-11 place-items-center rounded-full border border-line text-st-changes"
              aria-label="Borrar evento"
              disabled={pending}
              onClick={() => {
                if (!confirm("¿Borrar este evento?")) return;
                start(async () => {
                  await deleteEvent(initial.id);
                  router.refresh();
                  onClose();
                });
              }}
            >
              <Trash2 className="size-4" />
            </button>
          )}
          <button className="btn-primary flex-1" onClick={save} disabled={pending}>
            {pending ? "Guardando…" : "Guardar evento"}
          </button>
        </div>
      }
    >
      <p className="mb-5 flex items-center gap-1.5 text-[13px] text-muted">
        <Lock className="size-3.5" /> Solo lo ve tu equipo. No aparece en el link del cliente.
      </p>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {EVENT_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "flex h-11 items-center gap-2 rounded-xl border px-3 text-[14px] font-semibold transition-colors",
                type === t ? "border-inverse bg-inverse text-inverse-ink" : "border-line bg-surface text-ink-2",
              )}
            >
              <EventIcon type={t} /> {EVENT_LABEL[t]}
            </button>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="ev-title">Qué es</label>
          <input
            id="ev-title"
            className="field"
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === "shoot" ? "Ej. Rodaje reels en el local" : type === "meeting" ? "Ej. Reunión de planificación" : "Ej. Entregar grilla de noviembre"}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ev-date">Fecha</label>
            <input id="ev-date" type="date" className="field" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ev-time">Hora</label>
            <input id="ev-time" type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div>
          <p className="label">Cliente</p>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            <button type="button" className="chip" data-on={clientId === null} onClick={() => setClientId(null)}>
              General
            </button>
            {clients.map((c) => (
              <button key={c.id} type="button" className="chip pl-1.5" data-on={clientId === c.id} onClick={() => setClientId(c.id)}>
                <ClientAvatar client={c} size={22} /> {c.handle}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ev-notes">Notas</label>
          <textarea
            id="ev-notes"
            className="field min-h-[96px] resize-y"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Dirección, equipo, qué llevar, lista de tomas…"
          />
        </div>
        {error && <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[14px]">{error}</p>}
      </div>
    </Sheet>
  );
}
