import { cn, initials, mediaUrl } from "@/lib/utils";

type AvatarClient = { name: string; color: string; avatarId: string | null };

export function ClientAvatar({
  client,
  size = 36,
  ring,
  share,
  className,
}: {
  client: AvatarClient;
  size?: number;
  /** Aro de color alrededor (como las historias de IG): marca pendientes. */
  ring?: boolean;
  share?: string;
  className?: string;
}) {
  const inner = (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full font-display font-bold text-white"
      style={{ width: size, height: size, background: client.color, fontSize: Math.max(10, size * 0.36) }}
    >
      {client.avatarId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(client.avatarId, share)} alt="" className="size-full object-cover" />
      ) : (
        initials(client.name)
      )}
    </span>
  );

  if (!ring) return <span className={cn("inline-flex shrink-0", className)}>{inner}</span>;
  return (
    <span
      className={cn("inline-flex shrink-0 rounded-full p-[2px]", className)}
      style={{ background: "conic-gradient(from 210deg, var(--c-accent), #ffb020, var(--c-accent))" }}
    >
      <span className="rounded-full bg-surface p-[2px]">{inner}</span>
    </span>
  );
}

export function PersonAvatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <span
      title={name}
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}
