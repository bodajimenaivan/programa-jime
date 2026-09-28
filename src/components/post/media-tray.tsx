"use client";

import { useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Plus, X } from "lucide-react";
import type { PostFormat } from "@/lib/db/schema";
import { FORMAT_RATIO } from "@/lib/constants";
import { MAX_UPLOAD_BYTES, uploadMedia } from "@/lib/uploader";
import { cn, formatBytes, formatDuration } from "@/lib/utils";

export type TrayItem = {
  key: string;
  id: string | null;
  kind: "image" | "video";
  url: string;
  posterUrl: string | null;
  name: string;
  size: number;
  duration: number | null;
  progress: number;
  state: "uploading" | "ready" | "error";
  error?: string;
  abort?: () => void;
};

export function maxFiles(format: PostFormat) {
  return format === "carousel" ? 20 : format === "story" ? 30 : 1;
}

export function MediaTray({
  format,
  items,
  setItems,
}: {
  format: PostFormat;
  items: TrayItem[];
  setItems: React.Dispatch<React.SetStateAction<TrayItem[]>>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const limit = maxFiles(format);
  const canAdd = items.length < limit || limit === 1;

  const update = (key: string, patch: Partial<TrayItem>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const add = (files: File[]) => {
    setNotice(null);
    const accepted = files.filter((f) => /^(image|video)\//.test(f.type) || /\.(mov|mp4|m4v|webm|heic)$/i.test(f.name));
    if (accepted.length < files.length) setNotice("Algunos archivos no son fotos ni videos y se ignoraron.");
    const tooBig = accepted.filter((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig.length) setNotice(`${tooBig.map((f) => f.name).join(", ")} supera el máximo de ${formatBytes(MAX_UPLOAD_BYTES)}.`);
    let list = accepted.filter((f) => f.size <= MAX_UPLOAD_BYTES);
    if (limit === 1) {
      list = list.slice(0, 1);
      if (list.length) items.forEach((it) => it.abort?.());
    } else {
      list = list.slice(0, Math.max(0, limit - items.length));
    }
    if (!list.length) return;

    const fresh: TrayItem[] = list.map((f) => ({
      key: crypto.randomUUID(),
      id: null,
      kind: f.type.startsWith("video/") || /\.(mov|mp4|m4v|webm)$/i.test(f.name) ? "video" : "image",
      url: URL.createObjectURL(f),
      posterUrl: null,
      name: f.name,
      size: f.size,
      duration: null,
      progress: 0,
      state: "uploading",
    }));
    setItems((prev) => (limit === 1 ? fresh : [...prev, ...fresh]));

    fresh.forEach(async (it, i) => {
      try {
        const { probe, handle } = await uploadMedia(list[i], (p) => update(it.key, { progress: p }));
        update(it.key, { abort: handle.abort, duration: probe.duration ?? null });
        const id = await handle.promise;
        update(it.key, { id, state: "ready", progress: 1, abort: undefined });
      } catch (e) {
        update(it.key, { state: "error", error: e instanceof Error ? e.message : "Error al subir" });
      }
    });
  };

  const remove = (key: string) =>
    setItems((prev) => {
      prev.find((p) => p.key === key)?.abort?.();
      return prev.filter((p) => p.key !== key);
    });

  const move = (key: string, dir: -1 | 1) =>
    setItems((prev) => {
      const i = prev.findIndex((p) => p.key === key);
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const ratio = FORMAT_RATIO[format];

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        add([...e.dataTransfer.files]);
      }}
      className={cn("rounded-2xl transition-colors", over && "bg-accent-soft outline-2 outline-dashed outline-accent")}
    >
      <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {items.map((it, i) => (
          <div key={it.key} className="relative w-[112px] shrink-0 lg:w-[120px]">
            <div className="relative overflow-hidden rounded-xl bg-sunken" style={{ aspectRatio: ratio }}>
              {it.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.url} alt="" className="size-full object-cover" />
              ) : (
                <video
                  src={it.url + (it.url.startsWith("blob:") ? "" : "#t=0.1")}
                  poster={it.posterUrl ?? undefined}
                  preload="metadata"
                  muted
                  playsInline
                  className="size-full object-cover"
                />
              )}
              {it.state === "uploading" && (
                <div className="absolute inset-0 flex flex-col justify-end bg-black/45 p-2 text-white">
                  <span className="font-display text-[20px] font-bold leading-none">{Math.round(it.progress * 100)}%</span>
                  <span className="mt-0.5 text-[10.5px] text-white/80">
                    {formatBytes(it.size * it.progress)} de {formatBytes(it.size)}
                  </span>
                  <span className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/25">
                    <span className="block h-full bg-white transition-[width]" style={{ width: `${it.progress * 100}%` }} />
                  </span>
                </div>
              )}
              {it.state === "error" && (
                <div className="absolute inset-0 grid place-items-center bg-[rgb(229_72_77/0.85)] p-2 text-center text-[11px] font-medium text-white">
                  <span>
                    <AlertCircle className="mx-auto mb-1 size-4" />
                    {it.error}
                  </span>
                </div>
              )}
              {it.state === "ready" && it.kind === "video" && it.duration && (
                <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 text-[11px] font-medium text-white">
                  {formatDuration(it.duration)}
                </span>
              )}
              {items.length > 1 && (
                <span className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-black/60 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(it.key)}
                className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white"
                aria-label="Quitar archivo"
              >
                <X className="size-3.5" strokeWidth={2.5} />
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between gap-1">
              <span className="truncate text-[11px] text-muted" title={it.name}>
                {formatBytes(it.size)}
              </span>
              {items.length > 1 && (
                <span className="flex">
                  <button type="button" onClick={() => move(it.key, -1)} disabled={i === 0} className="grid size-6 place-items-center text-ink-2 disabled:opacity-25" aria-label="Mover antes">
                    <ArrowLeft className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => move(it.key, 1)} disabled={i === items.length - 1} className="grid size-6 place-items-center text-ink-2 disabled:opacity-25" aria-label="Mover después">
                    <ArrowRight className="size-3.5" />
                  </button>
                </span>
              )}
            </div>
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-[112px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-line-strong bg-surface text-center text-ink-2 transition-colors hover:border-ink hover:text-ink lg:w-[120px]"
            style={{ aspectRatio: ratio }}
          >
            <span className="grid size-9 place-items-center rounded-full bg-sunken">
              <Plus className="size-5" strokeWidth={2.5} />
            </span>
            <span className="px-2 text-[12.5px] font-semibold leading-tight">
              {items.length && limit === 1 ? "Reemplazar" : "Subir foto o video"}
            </span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        multiple={limit > 1}
        accept="image/*,video/*,.mov,.heic"
        onChange={(e) => {
          add([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <p className="mt-2 text-[12.5px] text-muted">
        {limit > 1 ? `Hasta ${limit} archivos` : "Un archivo"} de hasta {formatBytes(MAX_UPLOAD_BYTES)} cada uno. Si se corta la conexión, la subida sigue desde donde quedó.
      </p>
      {items.length > limit && (
        <p className="mt-1.5 text-[12.5px] font-medium text-st-review">
          Este formato usa un solo archivo: se va a mostrar el primero. Cambiá a carrusel o historia para usar todos.
        </p>
      )}
      {notice && <p className="mt-1.5 text-[12.5px] font-medium text-st-changes">{notice}</p>}
    </div>
  );
}
