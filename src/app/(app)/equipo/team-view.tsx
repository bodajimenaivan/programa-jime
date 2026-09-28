"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, ChevronRight, Mail, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import type { AgendaDTO, MemberDTO } from "@/lib/queries";
import type { PostFormat, PostStatus } from "@/lib/db/schema";
import { EVENT_LABEL, SWATCHES, TASK_COLUMNS } from "@/lib/constants";
import { formatDayShort, relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { PersonAvatar, ClientAvatar } from "@/components/ui/avatar";
import { Sheet } from "@/components/ui/sheet";
import { FormatIcon, StatusPill } from "@/components/post/bits";
import { EventIcon } from "@/components/calendar/event-sheet";
import { deleteMember, saveMember } from "../actions/team";
import { switchClient } from "../actions/clients";

type ClientInfo = { id: string; name: string; handle: string; color: string; avatarId: string | null };

const ROLE_SUGGESTIONS = ["Community manager", "Diseño", "Fotografía", "Edición de video", "Redacción", "Cuentas"];

export function TeamView({
  today,
  members,
  agenda,
  clients,
}: {
  today: string;
  members: MemberDTO[];
  agenda: AgendaDTO;
  clients: ClientInfo[];
}) {
  const [editing, setEditing] = useState<MemberDTO | "new" | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const clientsById = new Map(clients.map((c) => [c.id, c]));
  const unassignedTasks = agenda.tasks.filter((t) => !t.assigneeId).length;

  const itemsFor = (id: string) => ({
    tasks: agenda.tasks.filter((t) => t.assigneeId === id),
    posts: agenda.posts.filter((p) => p.assigneeId === id),
    events: agenda.events.filter((e) => e.people.includes(id)),
  });
  const person = members.find((m) => m.id === viewing) ?? null;

  return (
    <div className="mx-auto max-w-4xl px-5 pb-12 lg:px-8">
      <PageHeader
        title="Mi equipo"
        subtitle="Quiénes trabajan con vos. Asignales tareas, piezas y eventos, y mirá qué le toca a cada uno."
        action={
          <button className="btn-primary btn-sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" strokeWidth={2.5} /> Sumar
          </button>
        }
      />

      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
        {members.map((m) => {
          const it = itemsFor(m.id);
          const overdue = it.tasks.filter((t) => t.dueDate && t.dueDate < today).length;
          return (
            <li key={m.id} className="card min-w-0">
              <button onClick={() => setViewing(m.id)} className="flex w-full items-center gap-3.5 p-4 text-left">
                <PersonAvatar name={m.name} color={m.color} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[16px] font-semibold">{m.name}</span>
                    {m.isOwner && <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-2">Vos</span>}
                  </span>
                  <span className="block truncate text-[13px] text-muted">{m.role || "Sin rol"}</span>
                  <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-ink-2">
                    <span>
                      <b>{it.tasks.length}</b> {it.tasks.length === 1 ? "tarea" : "tareas"}
                      {overdue > 0 && <span className="font-semibold text-st-changes"> ({overdue} vencida{overdue > 1 ? "s" : ""})</span>}
                    </span>
                    <span>
                      <b>{it.posts.length}</b> {it.posts.length === 1 ? "pieza" : "piezas"}
                    </span>
                    <span>
                      <b>{it.events.length}</b> {it.events.length === 1 ? "evento" : "eventos"}
                    </span>
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted" />
              </button>
            </li>
          );
        })}
      </ul>

      {unassignedTasks > 0 && (
        <p className="mt-5 rounded-2xl bg-sunken/70 px-4 py-3 text-[14px] text-ink-2">
          Hay <b>{unassignedTasks}</b> {unassignedTasks === 1 ? "tarea pendiente sin responsable" : "tareas pendientes sin responsable"}. Asignalas desde{" "}
          <Link href="/tareas" className="font-semibold underline underline-offset-4">
            Tareas
          </Link>
          .
        </p>
      )}

      <Sheet open={!!person} onClose={() => setViewing(null)} title={person ? `Qué le toca a ${person.name.split(" ")[0]}` : ""} wide>
        {person && (
          <Agenda
            person={person}
            items={itemsFor(person.id)}
            today={today}
            clientsById={clientsById}
            onEdit={() => {
              setViewing(null);
              setEditing(person);
            }}
          />
        )}
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Sumar al equipo" : "Editar persona"}>
        {editing && <MemberForm key={editing === "new" ? "new" : editing.id} member={editing === "new" ? null : editing} onDone={() => setEditing(null)} defaultColor={SWATCHES[members.length % SWATCHES.length]} />}
      </Sheet>
    </div>
  );
}

function Agenda({
  person,
  items,
  today,
  clientsById,
  onEdit,
}: {
  person: MemberDTO;
  items: AgendaDTO & { tasks: AgendaDTO["tasks"] };
  today: string;
  clientsById: Map<string, ClientInfo>;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const phone = person.phone.replace(/[^\d]/g, "");
  const empty = items.tasks.length + items.posts.length + items.events.length === 0;

  const ClientTag = ({ id }: { id: string | null }) => {
    const c = id ? clientsById.get(id) : null;
    if (!c) return <span className="text-muted">General</span>;
    return (
      <span className="inline-flex min-w-0 items-center gap-1">
        <ClientAvatar client={c} size={14} /> <span className="truncate">{c.handle}</span>
      </span>
    );
  };
  const when = (d: string | null) => (d ? relativeDay(d, today) ?? formatDayShort(d) : "Sin fecha");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PersonAvatar name={person.name} color={person.color} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{person.name}</p>
          <p className="truncate text-[13px] text-muted">{person.role || "Sin rol"}</p>
        </div>
        <div className="flex gap-1.5">
          {phone && (
            <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="grid size-10 place-items-center rounded-full border border-line" aria-label="WhatsApp">
              <MessageCircle className="size-4" />
            </a>
          )}
          {person.email && (
            <a href={`mailto:${person.email}`} className="grid size-10 place-items-center rounded-full border border-line" aria-label="Email">
              <Mail className="size-4" />
            </a>
          )}
          <button onClick={onEdit} className="grid size-10 place-items-center rounded-full border border-line" aria-label="Editar">
            <Pencil className="size-4" />
          </button>
        </div>
      </div>

      {empty && <p className="rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-[14.5px] text-muted">No tiene nada asignado por ahora.</p>}

      {items.events.length > 0 && (
        <section>
          <h3 className="eyebrow mb-2">Próximos eventos</h3>
          <ul className="space-y-2">
            {items.events.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/calendario?ver=todos&mes=${e.date.slice(0, 7)}&dia=${e.date}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-line-strong"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-green text-white">
                    <EventIcon type={e.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{e.title}</span>
                    <span className="flex items-center gap-2 text-[12.5px] text-ink-2">
                      <span className="shrink-0">
                        {EVENT_LABEL[e.type]} · {when(e.date)}
                        {e.time && ` · ${e.time}`}
                      </span>
                      <ClientTag id={e.clientId} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.tasks.length > 0 && (
        <section>
          <h3 className="eyebrow mb-2">Tareas pendientes</h3>
          <ul className="space-y-2">
            {items.tasks.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() =>
                    start(async () => {
                      await switchClient(t.clientId);
                      router.push("/tareas");
                    })
                  }
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left hover:border-line-strong"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sunken text-ink-2">
                    <Check className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{t.title}</span>
                    <span className="flex items-center gap-2 text-[12.5px] text-ink-2">
                      <span className={cn("shrink-0", t.dueDate && t.dueDate < today && "font-semibold text-st-changes")}>
                        <CalendarClock className="mr-1 inline size-3.5" />
                        {when(t.dueDate)}
                      </span>
                      <span className="shrink-0 text-muted">· {TASK_COLUMNS.find((c) => c.id === t.status)?.label}</span>
                      <ClientTag id={t.clientId} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.posts.length > 0 && (
        <section>
          <h3 className="eyebrow mb-2">Piezas a cargo</h3>
          <ul className="space-y-2">
            {items.posts.map((p) => (
              <li key={p.id}>
                <Link href={`/posts/${p.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-line-strong">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sunken text-ink-2">
                    <FormatIcon format={p.format as PostFormat} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{p.title}</span>
                    <span className="flex items-center gap-2 text-[12.5px] text-ink-2">
                      <span className="shrink-0">
                        {when(p.date)}
                        {p.time && ` · ${p.time}`}
                      </span>
                      <ClientTag id={p.clientId} />
                    </span>
                  </span>
                  <StatusPill status={p.status as PostStatus} className="hidden sm:inline-flex" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MemberForm({ member, onDone, defaultColor }: { member: MemberDTO | null; onDone: () => void; defaultColor: string }) {
  const router = useRouter();
  const [name, setName] = useState(member?.name ?? "");
  const [role, setRole] = useState(member?.role ?? "");
  const [color, setColor] = useState(member?.color ?? defaultColor);
  const [email, setEmail] = useState(member?.email ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveMember({ id: member?.id, name, role, color, email, phone });
          if ("error" in res) return setError(res.error);
          router.refresh();
          onDone();
        });
      }}
    >
      <div className="flex items-center gap-4">
        <PersonAvatar name={name || "?"} color={color} size={56} />
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className="grid size-7 place-items-center rounded-full" style={{ background: c }} aria-label={`Color ${c}`}>
              {c === color && <Check className="size-3.5 text-white" strokeWidth={3.5} />}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="m-name">Nombre</label>
        <input id="m-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Tomás Ríos" required />
      </div>
      <div>
        <label className="label" htmlFor="m-role">Rol</label>
        <input id="m-role" className="field" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ej. Fotografía" />
        <div className="no-scrollbar -mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5">
          {ROLE_SUGGESTIONS.map((r) => (
            <button key={r} type="button" className="chip h-8 px-3 text-[13px]" data-on={role === r} onClick={() => setRole(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="m-phone">WhatsApp / teléfono <span className="font-normal text-muted">(opcional)</span></label>
          <input id="m-phone" className="field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 9 11 …" />
        </div>
        <div>
          <label className="label" htmlFor="m-email">Email <span className="font-normal text-muted">(opcional)</span></label>
          <input id="m-email" className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      {error && <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[14px]">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Guardando…" : member ? "Guardar cambios" : "Sumar al equipo"}
      </button>
      {member && !member.isOwner && (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 text-[14px] font-medium text-st-changes"
          onClick={() => {
            if (!confirm(`¿Sacar a ${member.name} del equipo? Sus tareas y piezas quedan sin responsable.`)) return;
            start(async () => {
              await deleteMember(member.id);
              router.refresh();
              onDone();
            });
          }}
        >
          <Trash2 className="size-4" /> Sacar del equipo
        </button>
      )}
    </form>
  );
}
