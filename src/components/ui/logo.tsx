import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <rect x="2" y="2" width="9" height="9" rx="2.5" fill="currentColor" />
      <rect x="13" y="2" width="9" height="9" rx="2.5" fill="currentColor" opacity="0.35" />
      <rect x="2" y="13" width="9" height="9" rx="2.5" fill="currentColor" opacity="0.35" />
      <rect x="13" y="13" width="9" height="9" rx="4.5" fill="var(--c-accent)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <LogoMark />
      <span className="font-display text-[22px] font-extrabold leading-none tracking-[-0.03em]">grilla</span>
    </span>
  );
}
