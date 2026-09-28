"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CalendarDays, Check, CheckCircle2, ExternalLink, Pencil, Plus, RefreshCw, Share2 } from "lucide-react";
import type { Network } from "@/lib/db/schema";
import { ClientAvatar } from "@/components/ui/avatar";
import { NetworkIcon } from "@/components/ui/network-icon";
import { Sheet } from "@/components/ui/sheet";
import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/ui/page-header";
import { archiveClient, resetShareLink, switchClient } from "../actions/clients";
import { cn } from "@/lib/utils";
import { absUrl, url } from "@/lib/base";
import { shareLink } from "@/lib/share";

type Row = {
  id: string;
  name: string;
  handle: string;
  color: string;
  avatarId: string | null;
  networks: Network[];
  shareToken: string;
  review: number;
  changes: number;
  approved: number;
  total: number;
};

export function ClientsView({ clients, activeId, startAdding }: { clients: Row[]; activeId: string | null; startAdding: boolean }) {
  const [adding, setAdding] = useState(startAdding);
  const [editing, setEditing] = useState<Row | null>(null);
  const router = useRouter();

  return (
    <div className="mx-auto max-w-4xl px-5 pb-12 lg:px-8">
      <PageHeader
        title="Clientes"
        subtitle="Cada cliente es un perfil con su calendario, tareas, métricas y su propio link para aprobar."
        action={
          <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" strokeWidth={2.5} /> Nuevo
          </button>
        }
      />

      {clients.length === 0 ? (
        <div className="card mt-2 grid place-items-center px-6 py-14 text-center">
          <p className="font-display text-[22px] font-bold">Sumá tu primer cliente</p>
          <p className="mt-1 max-w-sm text-[15px] text-muted">
            Después vas a poder saltar entre cuentas como en Instagram, desde el nombre de arriba.
          </p>
          <button className="btn-accent mt-6" onClick={() => setAdding(true)}>
            <Plus className="size-[18px]" strokeWidth={2.5} /> Agregar cliente
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          {clients.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              active={c.id === activeId}
              onEdit={() => setEditing(c)}
              onOpen={async () => {
                await switchClient(c.id);
                router.push("/calendario");
              }}
            />
          ))}
        </ul>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Nuevo cliente">
        <ClientForm
          onDone={() => {
            setAdding(false);
            router.replace("/calendario");
          }}
        />
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Editar cliente">
        {editing && <ClientForm key={editing.id} initial={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

function ClientCard({ client: c, active, onEdit, onOpen }: { client: Row; active: boolean; onEdit: () => void; onOpen: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [busy, start] = useTransition();
  useEffect(() => setOrigin(absUrl("")), []);
  const calendarPath = `/p/${c.shareToken}?vista=calendario`;
  const approvePath = `/p/${c.shareToken}`;

  const share = async (key: string, path: string, title: string) => {
    const res = await shareLink(`${origin}${path}`, title);
    if (res === "copied") {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    }
  };

  return (
    <li className={cn("card min-w-0 p-4", active && "ring-2 ring-ink/80")}>
      <div className="flex items-start gap-3">
        <button onClick={onOpen} className="shrink-0" aria-label={`Abrir ${c.name}`}>
          <ClientAvatar client={c} size={52} ring={c.changes > 0} />
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={onOpen} className="block max-w-full text-left">
            <p className="truncate text-[16px] font-semibold">{c.name}</p>
            <p className="flex items-center gap-1.5 text-[13px] text-muted">
              @{c.handle}
              <span className="flex gap-1">
                {c.networks.map((n) => (
                  <NetworkIcon key={n} network={n} className="size-3.5" />
                ))}
              </span>
            </p>
          </button>
        </div>
        <button onClick={onEdit} className="grid size-9 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label="Editar">
          <Pencil className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat n={c.review} label="Para aprobar" tone="review" />
        <Stat n={c.changes} label="Con cambios" tone="changes" />
        <Stat n={c.approved} label="Aprobadas" tone="approved" />
      </div>

      <div className="mt-4 space-y-2.5 rounded-xl bg-sunken/70 p-3">
        <p className="eyebrow">Links para el cliente</p>
        <ShareRow
          icon={<CalendarDays className="size-4" />}
          title="Calendario completo"
          hint="Ve todos los meses y puede aprobar desde ahí"
          copied={copied === "cal"}
          onShare={() => share("cal", calendarPath, `Calendario de ${c.name}`)}
          viewHref={url(calendarPath)}
        />
        <ShareRow
          icon={<CheckCircle2 className="size-4" />}
          title="Solo lo que falta aprobar"
          hint={c.review ? `${c.review} ${c.review === 1 ? "pieza esperando" : "piezas esperando"}` : "Nada pendiente ahora"}
          copied={copied === "ok"}
          onShare={() => share("ok", approvePath, `Para aprobar: ${c.name}`)}
          viewHref={url(approvePath)}
        />
        <button
          className="flex items-center gap-1.5 pt-1 text-[12.5px] text-muted hover:text-ink disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            if (confirm("Los links actuales van a dejar de funcionar. ¿Generar links nuevos?")) start(() => resetShareLink(c.id));
          }}
        >
          <RefreshCw className="size-3.5" /> Generar links nuevos
        </button>
      </div>

      <button
        className="mt-3 flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
        onClick={() => {
          if (confirm(`¿Archivar a ${c.name}? Deja de aparecer en el selector.`)) start(() => archiveClient(c.id));
        }}
      >
        <Archive className="size-3.5" /> Archivar
      </button>
    </li>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: "review" | "changes" | "approved" }) {
  const color = { review: "var(--c-review)", changes: "var(--c-changes)", approved: "var(--c-approved)" }[tone];
  return (
    <div className="rounded-xl border border-line px-2 py-2.5">
      <p className="font-display text-[22px] font-bold leading-none" style={{ color: n ? color : undefined }}>
        {n}
      </p>
      <p className="mt-1 text-[11.5px] text-muted">{label}</p>
    </div>
  );
}

function ShareRow({
  icon,
  title,
  hint,
  copied,
  onShare,
  viewHref,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  copied: boolean;
  onShare: () => void;
  viewHref: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-surface p-2 pl-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-ink-2">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{title}</p>
        <p className="truncate text-[12px] text-muted">{hint}</p>
      </div>
      <a href={viewHref} target="_blank" rel="noreferrer" className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-ink-2 hover:bg-sunken" aria-label={`Ver ${title}`}>
        <ExternalLink className="size-4" />
      </a>
      <button className="btn-primary btn-sm size-9 shrink-0 px-0 sm:w-auto sm:px-3.5" onClick={onShare} aria-label={`Compartir ${title}`}>
        {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
        <span className="hidden sm:inline">{copied ? "Copiado" : "Compartir"}</span>
      </button>
    </div>
  );
}
