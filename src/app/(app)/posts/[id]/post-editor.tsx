"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CopyPlus, Hash, Send, Trash2 } from "lucide-react";
import type { Client, Comment, Network, PostFormat, PostMetrics, PostStatus } from "@/lib/db/schema";
import type { MediaDTO } from "@/lib/queries";
import { CAPTION_LIMIT, FORMAT_LABEL, FORMAT_ORDER, NETWORK_LABEL, NETWORK_ORDER, STATUS_LABEL, STATUS_ORDER } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { absUrl } from "@/lib/base";
import { ClientAvatar } from "@/components/ui/avatar";
import { NetworkIcon } from "@/components/ui/network-icon";
import { FormatIcon, StatusDot } from "@/components/post/bits";
import { PostPreview, PreviewLabel } from "@/components/post/preview";
import { MediaDownloads } from "@/components/post/downloads";
import { MediaTray, type TrayItem } from "@/components/post/media-tray";
import { CommentThread } from "@/components/post/comment-thread";
import { useToast } from "@/components/ui/toast";
import { CopyButton } from "@/components/ui/copy-button";
import { EmojiTextarea } from "@/components/ui/emoji-textarea";
import { HashtagPanel } from "@/components/post/hashtag-panel";
import { PeoplePicker, type Person } from "@/components/team/people-picker";
import { deletePost, duplicatePost, savePost, savePostMetrics } from "../../actions/posts";

type Initial = {
  format: PostFormat;
  networks: Network[];
  date: string;
  time: string | null;
  title: string;
  caption: string;
  status: PostStatus;
  notes: string;
  postMetrics: PostMetrics | null;
  assigneeId?: string | null;
};

export function PostEditor({
  id,
  client: initialClient,
  clients = [],
  team = [],
  initial,
  media,
  comments,
}: {
  id?: string;
  client: Client;
  /** Para poder elegir o cambiar de cliente desde el editor. */
  clients?: Client[];
  /** Personas del equipo (para "A cargo de"). */
  team?: Person[];
  initial: Initial;
  media: MediaDTO[];
  comments: Comment[];
}) {
  const router = useRouter();
  const [toast, showToast] = useToast();
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState(initialClient.id);
  const client = clients.find((c) => c.id === clientId) ?? initialClient;
  const [format, setFormat] = useState(initial.format);
  const [networks, setNetworks] = useState<Network[]>(initial.networks);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time ?? "");
  const [title, setTitle] = useState(initial.title);
  const [caption, setCaption] = useState(initial.caption);
  const [status, setStatus] = useState<PostStatus>(initial.status);
  const [notes, setNotes] = useState(initial.notes);
  const [assignee, setAssignee] = useState<string[]>(initial.assigneeId ? [initial.assigneeId] : []);
  const [items, setItems] = useState<TrayItem[]>(() =>
    media.map((m) => ({
      key: m.id,
      id: m.id,
      kind: m.kind,
      url: m.url,
      posterUrl: m.posterUrl,
      name: m.filename,
      size: m.size,
      duration: m.duration,
      progress: 1,
      state: "ready",
    })),
  );

  const snapshot = JSON.stringify([assignee, clientId, format, networks, date, time, title, caption, status, notes, items.map((i) => i.id ?? i.key)]);
  const [saved, setSaved] = useState(snapshot);
  const dirty = snapshot !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Si suben 2+ archivos a un post, lo tratamos como carrusel.
  useEffect(() => {
    if (format === "post" && items.length > 1) setFormat("carousel");
  }, [items.length, format]);

  const uploading = items.filter((i) => i.state === "uploading");
  const progress = uploading.length ? uploading.reduce((a, i) => a + i.progress, 0) / uploading.length : 1;
  const hashtags = (caption.match(/#[\p{L}\d_]+/gu) ?? []).length;

  const previewMedia = useMemo(
    () =>
      items
        .filter((i) => i.state !== "error")
        .map((i) => ({ id: i.key, kind: i.kind, url: i.url, posterUrl: i.posterUrl })),
    [items],
  );

  const backHref = `/calendario?mes=${date.slice(0, 7)}&dia=${date}`;

  const save = (nextStatus?: PostStatus) =>
    new Promise<string | null>((resolve) => {
      setError(null);
      startSave(async () => {
        const st = nextStatus ?? status;
        const res = await savePost({
          id,
          clientId: client.id,
          title,
          caption,
          format,
          networks,
          date,
          time: time || null,
          status: st,
          notes,
          assigneeId: assignee[0] ?? null,
          mediaIds: items.filter((i) => i.state === "ready" && i.id).map((i) => i.id!),
        });
        if ("error" in res) {
          setError(res.error);
          resolve(null);
          return;
        }
        setStatus(st);
        setSaved(JSON.stringify([assignee, clientId, format, networks, date, time, title, caption, st, notes, items.map((i) => i.id ?? i.key)]));
        if (!id) router.replace(`/posts/${res.id}`);
        else router.refresh();
        resolve(res.id);
      });
    });

  const askApproval = async () => {
    const savedId = await save("review");
    if (!savedId) return;
    const url = absUrl(`/p/${client.shareToken}?pieza=${savedId}`);
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: `Para aprobar: ${title || "nueva pieza"}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast("Link copiado. Mandáselo al cliente.");
      }
    } catch {
      showToast("Quedó para aprobar.");
    }
  };

  const saveLabel = uploading.length
    ? `Subiendo ${Math.round(progress * 100)}%`
    : saving
      ? "Guardando…"
      : dirty || !id
        ? "Guardar"
        : "Guardado";

  return (
    <div className="min-h-dvh">
      {/* Barra superior */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-2 lg:h-16 lg:px-8">
          <Link href={backHref} className="grid size-10 place-items-center rounded-full hover:bg-sunken" aria-label="Volver al calendario">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ClientAvatar client={client} size={26} />
            <span className="truncate text-[15px] font-semibold">{id ? title || "Sin título" : "Nueva pieza"}</span>
          </div>
          <button
            onClick={() => save()}
            disabled={saving || uploading.length > 0 || (!dirty && !!id)}
            className={cn("btn-primary btn-sm min-w-[104px]", !dirty && id && "bg-sunken! text-ink-2!")}
          >
            {!dirty && id && !saving && <Check className="size-4" />}
            {saveLabel}
          </button>
        </div>
        <div className="flex px-5 lg:hidden">
          {(["edit", "preview"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px flex-1 border-b-2 pb-2.5 pt-1 text-[14px] font-semibold transition-colors",
                tab === t ? "border-ink text-ink" : "border-transparent text-muted",
              )}
            >
              {t === "edit" ? "Editar" : "Vista previa"}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-5 pb-32 pt-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-8 lg:pb-16 lg:pt-8">
        {/* Formulario */}
        <div className={cn("space-y-7", tab !== "edit" && "hidden lg:block")}>
          {clients.length > 1 && (
            <Section label="Cliente">
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
                {clients.map((c) => (
                  <button key={c.id} type="button" className="chip pl-1.5" data-on={clientId === c.id} onClick={() => setClientId(c.id)}>
                    <ClientAvatar client={c} size={22} /> {c.handle}
                  </button>
                ))}
              </div>
            </Section>
          )}

          <div>
            <label className="label" htmlFor="title">
              Título <span className="font-normal text-muted">(lo ve el cliente, para ubicar la pieza rápido)</span>
            </label>
            <input
              id="title"
              className="field text-[16px] font-semibold"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Promo 2x1 martes · Reel lanzamiento"
            />
          </div>

          <Section label="Formato">
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
              {FORMAT_ORDER.map((f) => (
                <button key={f} type="button" className="chip" data-on={format === f} onClick={() => setFormat(f)}>
                  <FormatIcon format={f} className="size-4" /> {FORMAT_LABEL[f]}
                </button>
              ))}
            </div>
          </Section>

          <Section label="Archivos">
            <MediaTray format={format} items={items} setItems={setItems} />
          </Section>

          <Section label="Texto de la publicación" action={<CopyButton text={caption} label="Copiar texto" />}>
            <EmojiTextarea
              className="field min-h-[150px] resize-y leading-relaxed"
              value={caption}
              maxLength={CAPTION_LIMIT}
              onChange={setCaption}
              placeholder="Escribí el texto que va a acompañar la publicación…"
              tools={[
                {
                  id: "hashtags",
                  label: "Hashtags",
                  icon: Hash,
                  panel: <HashtagPanel caption={caption} onChange={setCaption} maxLength={CAPTION_LIMIT} clientId={client.id} handle={client.handle} />,
                },
              ]}
              footer={
                <p className="text-right text-[12px] tabular-nums text-muted">
                  {caption.length.toLocaleString("es-AR")}/{CAPTION_LIMIT.toLocaleString("es-AR")} · {hashtags} hashtags
                </p>
              }
            />
          </Section>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="date">Fecha</label>
              <input id="date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="time">Hora</label>
              <input id="time" type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <Section label="Redes">
            <div className="flex flex-wrap gap-2">
              {NETWORK_ORDER.map((n) => {
                const on = networks.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    className="chip"
                    data-on={on}
                    onClick={() => setNetworks((prev) => (on ? prev.filter((x) => x !== n) : [...prev, n]))}
                  >
                    <NetworkIcon network={n} /> {NETWORK_LABEL[n]}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section label="Estado">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-xl border px-3 text-left text-[14px] font-semibold transition-colors",
                    status === s ? "border-ink bg-surface text-ink shadow-[0_0_0_1px_var(--c-ink)]" : "border-line bg-surface text-ink-2",
                  )}
                >
                  <StatusDot status={s} className="size-2.5" />
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
              {status === "draft"
                ? "El cliente la ve en su calendario como “En preparación”, sin poder aprobarla todavía."
                : status === "review" || status === "changes"
                  ? "El cliente la ve con los botones para aprobar o pedir cambios."
                  : "El cliente la ve en su calendario."}
            </p>
          </Section>

          {team.length > 0 && (
            <Section label="A cargo de">
              <PeoplePicker people={team} value={assignee} onChange={setAssignee} emptyLabel="Sin asignar" />
            </Section>
          )}

          <div>
            <label className="label" htmlFor="notes">
              Notas para el equipo <span className="font-normal text-muted">(el cliente no las ve)</span>
            </label>
            <textarea
              id="notes"
              className="field min-h-[88px] resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Referencias, música, pendientes…"
            />
          </div>

          {error && <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[14px]">{error}</p>}

          {id && status === "published" && <MetricsForm postId={id} initial={initial.postMetrics} onSaved={() => showToast("Métricas guardadas")} />}

          {id && (
            <Section label="Conversación con el cliente">
              <CommentThread postId={id} comments={comments} client={client} />
            </Section>
          )}

          {id && <DangerZone id={id} backHref={backHref} />}
        </div>

        {/* Vista previa */}
        <aside className={cn("lg:sticky lg:top-24 lg:self-start", tab !== "preview" && "hidden lg:block")}>
          <div className="mx-auto max-w-[360px]">
            <div className="mb-3 flex items-center justify-between">
              <PreviewLabel format={format} />
            </div>
            <PostPreview format={format} media={previewMedia} caption={caption} client={client} />
            <MediaDownloads
              className="mt-3"
              files={items
                .filter((i) => i.state === "ready")
                .map((i) => ({ id: i.key, url: i.url, filename: i.name, size: i.size, kind: i.kind }))}
            />
            <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
              <p className="text-[15px] font-semibold">¿Lista para el cliente?</p>
              <p className="mt-0.5 text-[13.5px] text-muted">
                Se guarda como “Para aprobar” y copiás un link directo a esta pieza. Lo abre desde el celu, sin cuenta.
              </p>
              <button className="btn-accent mt-3 w-full" onClick={askApproval} disabled={saving || uploading.length > 0}>
                <Send className="size-4" /> Pedir aprobación
              </button>
            </div>
          </div>
        </aside>
      </div>
      {toast}
    </div>
  );
}

function Section({ label, hint, action, children }: { label: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex min-h-8 items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-ink-2">{label}</h2>
        {hint && <span className="text-[12px] tabular-nums text-muted">{hint}</span>}
        {action}
      </div>
      {children}
    </section>
  );
}

const METRIC_FIELDS: { key: keyof PostMetrics; label: string }[] = [
  { key: "reach", label: "Alcance" },
  { key: "views", label: "Reproducciones" },
  { key: "likes", label: "Me gusta" },
  { key: "comments", label: "Comentarios" },
  { key: "saves", label: "Guardados" },
  { key: "shares", label: "Compartidos" },
];

function MetricsForm({ postId, initial, onSaved }: { postId: string; initial: PostMetrics | null; onSaved: () => void }) {
  const [values, setValues] = useState<PostMetrics>(initial ?? { reach: 0, views: 0, likes: 0, comments: 0, saves: 0, shares: 0 });
  const [pending, start] = useTransition();
  return (
    <Section label="Resultados de la publicación">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {METRIC_FIELDS.map((f) => (
          <label key={f.key} className="rounded-xl border border-line bg-surface px-3 py-2">
            <span className="block text-[12px] text-muted">{f.label}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className="w-full bg-transparent font-display text-[20px] font-bold outline-none"
              value={values[f.key] || ""}
              placeholder="0"
              onChange={(e) => setValues({ ...values, [f.key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <button
        className="btn-ghost btn-sm mt-3"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await savePostMetrics(postId, values);
            onSaved();
          })
        }
      >
        {pending ? "Guardando…" : "Guardar resultados"}
      </button>
    </Section>
  );
}

function DangerZone({ id, backHref }: { id: string; backHref: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2 border-t border-line pt-5">
      <button
        className="btn-ghost btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await duplicatePost(id);
            router.push(`/posts/${res.id}`);
          })
        }
      >
        <CopyPlus className="size-4" /> Duplicar
      </button>
      <button
        className="btn-ghost btn-sm text-st-changes!"
        disabled={pending}
        onClick={() => {
          if (!confirm("¿Eliminar esta pieza y sus archivos? No se puede deshacer.")) return;
          start(async () => {
            await deletePost(id);
            router.push(backHref);
          });
        }}
      >
        <Trash2 className="size-4" /> Eliminar
      </button>
    </div>
  );
}

