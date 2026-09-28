"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Send,
  Volume2,
  VolumeX,
  Plus,
} from "lucide-react";
import type { PostFormat } from "@/lib/db/schema";
import type { MediaDTO } from "@/lib/queries";
import { ClientAvatar } from "@/components/ui/avatar";
import { FormatIcon } from "./bits";
import { FORMAT_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type PreviewMedia = Pick<MediaDTO, "kind" | "url" | "posterUrl"> & { id: string };
type PreviewClient = { name: string; handle: string; color: string; avatarId: string | null };

export function PostPreview({
  format,
  media,
  caption,
  client,
  share,
  className,
}: {
  format: PostFormat;
  media: PreviewMedia[];
  caption: string;
  client: PreviewClient;
  share?: string;
  className?: string;
}) {
  if (format === "post" || format === "carousel") {
    return <FeedPreview media={media} caption={caption} client={client} share={share} className={className} />;
  }
  if (format === "story") return <StoryPreview media={media} client={client} share={share} className={className} />;
  return <VerticalPreview format={format} media={media} caption={caption} client={client} share={share} className={className} />;
}

function MediaView({
  m,
  active = true,
  fit = "cover",
  muted,
}: {
  m: PreviewMedia;
  active?: boolean;
  fit?: "cover" | "contain";
  muted: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) v.play().catch(() => {});
    else v.pause();
  }, [active]);

  if (m.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.url} alt="" draggable={false} className={cn("size-full select-none", fit === "cover" ? "object-cover" : "object-contain")} />;
  }
  return (
    <video
      ref={ref}
      src={m.url}
      poster={m.posterUrl ?? undefined}
      muted={muted}
      loop
      playsInline
      preload="metadata"
      className={cn("size-full", fit === "cover" ? "object-cover" : "object-contain")}
    />
  );
}

function Empty({ format, dark }: { format: PostFormat; dark?: boolean }) {
  return (
    <div className={cn("grid size-full place-items-center", dark ? "bg-[#1b1a17] text-white/50" : "bg-sunken text-muted")}>
      <div className="flex flex-col items-center gap-2 text-center text-[13px]">
        <FormatIcon format={format} className="size-7" />
        <span>Sin archivo todavía</span>
      </div>
    </div>
  );
}

function Caption({ handle, text, dark, lines = 2 }: { handle: string; text: string; dark?: boolean; lines?: number }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <p
      onClick={() => setOpen(!open)}
      className={cn("cursor-pointer whitespace-pre-line text-[13.5px] leading-snug", dark ? "text-white" : "text-[#111]")}
      style={open ? undefined : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }}
    >
      <span className="font-semibold">{handle}</span> {highlightTags(text, dark)}
    </p>
  );
}

function highlightTags(text: string, dark?: boolean) {
  return text.split(/(#[\p{L}\d_]+|@[\w.]+)/u).map((part, i) =>
    /^[#@]/.test(part) ? (
      <span key={i} className={dark ? "text-white/90" : "text-[#00376b]"}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/* ---------- Feed: post y carrusel ---------- */

function FeedPreview({
  media,
  caption,
  client,
  share,
  className,
}: {
  media: PreviewMedia[];
  caption: string;
  client: PreviewClient;
  share?: string;
  className?: string;
}) {
  const [i, setI] = useState(0);
  const [muted, setMuted] = useState(true);
  const track = useRef<HTMLDivElement>(null);
  const idx = Math.min(i, Math.max(0, media.length - 1));

  const go = (n: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className={cn("overflow-hidden rounded-[18px] border border-[#e6e6e6] bg-white text-[#111] shadow-pop", className)}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <ClientAvatar client={client} size={32} share={share} />
        <span className="flex-1 truncate text-[13.5px] font-semibold">{client.handle}</span>
        <MoreHorizontal className="size-5" />
      </div>
      <div className="relative aspect-[4/5] bg-[#f2f2f2]">
        {media.length === 0 ? (
          <Empty format="post" />
        ) : (
          <div
            ref={track}
            className="no-scrollbar flex size-full snap-x snap-mandatory overflow-x-auto"
            onScroll={(e) => {
              const el = e.currentTarget;
              setI(Math.round(el.scrollLeft / el.clientWidth));
            }}
          >
            {media.map((m, n) => (
              <div key={m.id} className="relative size-full shrink-0 snap-center">
                <MediaView m={m} active={n === idx} muted={muted} />
              </div>
            ))}
          </div>
        )}
        {media.length > 1 && (
          <>
            <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[12px] font-medium text-white">
              {idx + 1}/{media.length}
            </span>
            {idx > 0 && (
              <button onClick={() => go(idx - 1)} className="absolute left-2 top-1/2 hidden size-7 -translate-y-1/2 place-items-center rounded-full bg-white/85 shadow md:grid" aria-label="Anterior">
                <ChevronLeft className="size-4" />
              </button>
            )}
            {idx < media.length - 1 && (
              <button onClick={() => go(idx + 1)} className="absolute right-2 top-1/2 hidden size-7 -translate-y-1/2 place-items-center rounded-full bg-white/85 shadow md:grid" aria-label="Siguiente">
                <ChevronRight className="size-4" />
              </button>
            )}
          </>
        )}
        {media[idx]?.kind === "video" && (
          <button onClick={() => setMuted(!muted)} className="absolute bottom-3 right-3 grid size-7 place-items-center rounded-full bg-black/60 text-white" aria-label="Sonido">
            {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </button>
        )}
      </div>
      <div className="relative flex items-center gap-4 px-3 pt-2.5">
        <Heart className="size-6" strokeWidth={1.8} />
        <MessageCircle className="size-6 -scale-x-100" strokeWidth={1.8} />
        <Send className="size-6" strokeWidth={1.8} />
        {media.length > 1 && (
          <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 gap-1">
            {media.map((m, n) => (
              <span key={m.id} className={cn("size-1.5 rounded-full", n === idx ? "bg-[#0095f6]" : "bg-[#c7c7c7]")} />
            ))}
          </span>
        )}
        <Bookmark className="ml-auto size-6" strokeWidth={1.8} />
      </div>
      <div className="space-y-1 px-3 pb-3.5 pt-2">
        <Caption handle={client.handle} text={caption} />
      </div>
    </div>
  );
}

/* ---------- Reel y TikTok ---------- */

function VerticalPreview({
  format,
  media,
  caption,
  client,
  share,
  className,
}: {
  format: PostFormat;
  media: PreviewMedia[];
  caption: string;
  client: PreviewClient;
  share?: string;
  className?: string;
}) {
  const [muted, setMuted] = useState(true);
  const m = media[0];
  const tiktok = format === "tiktok";
  return (
    <div className={cn("relative aspect-[9/16] overflow-hidden rounded-[22px] bg-black text-white shadow-pop", className)}>
      {m ? <MediaView m={m} muted={muted} /> : <Empty format={format} dark />}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.25),transparent_18%,transparent_60%,rgb(0_0_0/0.55))]" />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3.5 text-[15px] font-semibold">
        {tiktok ? (
          <span className="mx-auto flex gap-4 text-[14px]">
            <span className="text-white/60">Siguiendo</span>
            <span className="border-b-2 border-white pb-0.5">Para ti</span>
          </span>
        ) : (
          <span className="text-[17px] font-bold">Reels</span>
        )}
      </div>
      {m?.kind === "video" && (
        <button onClick={() => setMuted(!muted)} className="absolute right-3 top-12 grid size-8 place-items-center rounded-full bg-black/40" aria-label="Sonido">
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      )}
      <div className="absolute bottom-24 right-2.5 flex flex-col items-center gap-4 text-[11px] font-semibold">
        {tiktok && (
          <span className="relative mb-1">
            <ClientAvatar client={client} size={40} share={share} className="rounded-full ring-2 ring-white" />
            <span className="absolute -bottom-2 left-1/2 grid size-4 -translate-x-1/2 place-items-center rounded-full bg-[#fe2c55]">
              <Plus className="size-3" strokeWidth={3} />
            </span>
          </span>
        )}
        <Heart className="size-7" strokeWidth={1.8} />
        <MessageCircle className="size-7 -scale-x-100" strokeWidth={1.8} />
        {tiktok ? <Bookmark className="size-7" strokeWidth={1.8} /> : <Send className="size-7" strokeWidth={1.8} />}
        {!tiktok && <MoreHorizontal className="size-6" />}
      </div>
      <div className="absolute inset-x-0 bottom-0 space-y-2 p-3.5 pr-16">
        <div className="flex items-center gap-2">
          {!tiktok && <ClientAvatar client={client} size={30} share={share} />}
          <span className="text-[14px] font-semibold">{tiktok ? `@${client.handle}` : client.handle}</span>
          {!tiktok && <span className="rounded-lg border border-white/70 px-2 py-0.5 text-[12px] font-semibold">Seguir</span>}
        </div>
        <Caption handle="" text={caption} dark lines={2} />
        <p className="flex items-center gap-1.5 text-[12px] text-white/90">
          <Music2 className="size-3.5" /> {client.handle} · Audio original
        </p>
      </div>
    </div>
  );
}

/* ---------- Historia ---------- */

function StoryPreview({
  media,
  client,
  share,
  className,
}: {
  media: PreviewMedia[];
  client: PreviewClient;
  share?: string;
  className?: string;
}) {
  const [i, setI] = useState(0);
  const [muted, setMuted] = useState(true);
  const idx = Math.min(i, Math.max(0, media.length - 1));
  const m = media[idx];
  return (
    <div className={cn("relative aspect-[9/16] select-none overflow-hidden rounded-[22px] bg-black text-white shadow-pop", className)}>
      {m ? <MediaView key={m.id} m={m} muted={muted} /> : <Empty format="story" dark />}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.35),transparent_20%,transparent_85%,rgb(0_0_0/0.4))]" />
      {media.length > 1 && (
        <>
          <button className="absolute inset-y-16 left-0 w-1/3" onClick={() => setI(Math.max(0, idx - 1))} aria-label="Anterior" />
          <button className="absolute inset-y-16 right-0 w-1/3" onClick={() => setI(Math.min(media.length - 1, idx + 1))} aria-label="Siguiente" />
        </>
      )}
      <div className="absolute inset-x-0 top-0 px-2.5 pt-2.5">
        <div className="flex gap-1">
          {(media.length ? media : [null]).map((_, n) => (
            <span key={n} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/35">
              <span className={cn("block h-full bg-white", n <= idx ? "w-full" : "w-0")} />
            </span>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <ClientAvatar client={client} size={30} share={share} />
          <span className="text-[13.5px] font-semibold">{client.handle}</span>
          <span className="text-[13px] text-white/70">2 h</span>
          {m?.kind === "video" && (
            <button onClick={() => setMuted(!muted)} className="ml-auto grid size-7 place-items-center" aria-label="Sonido">
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
          )}
          <MoreHorizontal className={cn("size-5", m?.kind !== "video" && "ml-auto")} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-3">
        <span className="flex-1 rounded-full border border-white/60 px-4 py-2.5 text-[13px] text-white/85">Enviar mensaje</span>
        <Heart className="size-6" strokeWidth={1.8} />
        <Send className="size-6" strokeWidth={1.8} />
      </div>
    </div>
  );
}

export function PreviewLabel({ format }: { format: PostFormat }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted">
      <FormatIcon format={format} /> Así se ve como {FORMAT_LABEL[format].toLowerCase()}
    </span>
  );
}
