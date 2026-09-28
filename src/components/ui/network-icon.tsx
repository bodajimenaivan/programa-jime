import type { Network } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const PATHS: Record<Network, React.ReactNode> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.4" cy="6.6" r="1.25" fill="currentColor" />
    </>
  ),
  tiktok: (
    <path
      fill="currentColor"
      d="M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.3 6.3 0 1 0 5.3 6.2V8.6a7.7 7.7 0 0 0 4.4 1.4V6.7a4.4 4.4 0 0 1-4.4-4.4Z"
    />
  ),
  facebook: (
    <path
      fill="currentColor"
      d="M13.5 21.9v-7.5h2.5l.4-3h-2.9V9.6c0-.9.3-1.5 1.5-1.5h1.5V5.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.3H8.1v3h2.5v7.5A10 10 0 1 1 13.5 21.9Z"
    />
  ),
  linkedin: (
    <path
      fill="currentColor"
      d="M4.5 3A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 19.5 3h-15Zm1.9 6.7h2.8V18H6.4V9.7Zm1.4-4.2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm3.3 4.2h2.7v1.1c.4-.7 1.3-1.4 2.7-1.4 2.9 0 3.4 1.9 3.4 4.3V18h-2.8v-3.8c0-.9 0-2.1-1.3-2.1s-1.5 1-1.5 2V18h-2.8V9.7Z"
    />
  ),
};

export function NetworkIcon({ network, className }: { network: Network; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4", className)} aria-hidden>
      {PATHS[network]}
    </svg>
  );
}
