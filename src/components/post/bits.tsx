import { Film, GalleryHorizontalEnd, ImageIcon, Music2, CircleDashed } from "lucide-react";
import type { PostFormat, PostStatus } from "@/lib/db/schema";
import { FORMAT_LABEL, STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { MediaDTO } from "@/lib/queries";

export const STATUS_VAR: Record<PostStatus, string> = {
  draft: "var(--c-draft)",
  review: "var(--c-review)",
  changes: "var(--c-changes)",
  approved: "var(--c-approved)",
  scheduled: "var(--c-scheduled)",
  published: "var(--c-published)",
};

export function StatusDot({ status, className }: { status: PostStatus; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: STATUS_VAR[status] }} />;
}

export function StatusPill({ status, className, label }: { status: PostStatus; className?: string; label?: string }) {
  return (
    <span
      className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold", className)}
      style={{
        background: `color-mix(in oklab, ${STATUS_VAR[status]} 14%, transparent)`,
        color: status === "draft" ? "var(--c-ink-2)" : `color-mix(in oklab, ${STATUS_VAR[status]} 80%, var(--c-ink))`,
      }}
    >
      <StatusDot status={status} className="size-1.5" />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

export function FormatIcon({ format, className }: { format: PostFormat; className?: string }) {
  const cls = cn("size-3.5", className);
  switch (format) {
    case "reel":
      return <Film className={cls} />;
    case "carousel":
      return <GalleryHorizontalEnd className={cls} />;
    case "story":
      return <CircleDashed className={cls} />;
    case "tiktok":
      return <Music2 className={cls} />;
    default:
      return <ImageIcon className={cls} />;
  }
}

export function FormatTag({ format, className }: { format: PostFormat; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12px] font-medium text-muted", className)}>
      <FormatIcon format={format} />
      {FORMAT_LABEL[format]}
    </span>
  );
}

/** Miniatura cuadrada/vertical de una pieza: imagen, portada del video o un placeholder con el formato. */
export function Thumb({
  media,
  format,
  className,
  rounded = "rounded-lg",
  badge = true,
}: {
  media: Pick<MediaDTO, "kind" | "url" | "posterUrl"> | null;
  format: PostFormat;
  className?: string;
  rounded?: string;
  badge?: boolean;
}) {
  if (!media) {
    return (
      <span
        className={cn("grid place-items-center overflow-hidden bg-sunken text-muted", rounded, className)}
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in oklab, var(--c-line-strong) 45%, transparent) 6px 7px)",
        }}
      >
        <FormatIcon format={format} className="size-[40%] max-h-5 max-w-5" />
      </span>
    );
  }
  const src = media.kind === "image" ? media.url : media.posterUrl;
  return (
    <span className={cn("relative block overflow-hidden bg-sunken", rounded, className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" draggable={false} className="size-full object-cover" />
      ) : (
        <video src={`${media.url}#t=0.1`} preload="metadata" muted playsInline className="size-full object-cover" />
      )}
      {badge && media.kind === "video" && (
        <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-black/45 text-white">
          <Film className="size-2.5" />
        </span>
      )}
    </span>
  );
}
