"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hoja inferior en mobile (se cierra deslizando hacia abajo) y diálogo centrado en desktop.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 animate-fade-in bg-[rgb(23_20_15/0.45)]" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex max-h-[92dvh] w-full animate-sheet-up flex-col rounded-t-[26px] bg-surface shadow-pop outline-none md:max-h-[86dvh] md:animate-pop-in md:rounded-[22px]",
          wide ? "md:max-w-2xl" : "md:max-w-md",
          className,
        )}
        style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
      >
        <div
          className="flex touch-none justify-center pb-1 pt-2.5 md:hidden"
          onPointerDown={(e) => {
            startY.current = e.clientY;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (startY.current !== null) setDrag(Math.max(0, e.clientY - startY.current));
          }}
          onPointerUp={() => {
            if (drag > 90) onClose();
            setDrag(0);
            startY.current = null;
          }}
        >
          <span className="h-1.5 w-10 rounded-full bg-line-strong" />
        </div>
        {title !== undefined && (
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-1 md:pt-5">
            <h2 className="font-display text-[20px] font-bold tracking-[-0.01em]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-full bg-sunken text-ink-2 transition-colors hover:text-ink"
              aria-label="Cerrar"
            >
              <X className="size-[18px]" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer && (
          <div className="border-t border-line px-5 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
