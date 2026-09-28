"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus, Settings2 } from "lucide-react";
import { ClientAvatar } from "@/components/ui/avatar";
import { NetworkIcon } from "@/components/ui/network-icon";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { switchClient } from "@/app/(app)/actions/clients";
import { ClientForm } from "@/components/clients/client-form";
import { useShell } from "./shell-context";

export function ClientSwitcher({ variant }: { variant: "topbar" | "sidebar" }) {
  const { clients, active } = useShell();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();

  const pick = (id: string) => {
    if (id === active?.id) return setOpen(false);
    setPendingId(id);
    start(async () => {
      await switchClient(id);
      router.refresh();
      setOpen(false);
      setPendingId(null);
    });
  };

  const trigger =
    variant === "topbar" ? (
      <button onClick={() => setOpen(true)} className="flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 active:bg-sunken">
        {active ? (
          <>
            <ClientAvatar client={active} size={32} ring={active.attention > 0} />
            <span className="truncate font-display text-[19px] font-bold tracking-[-0.01em]">{active.handle}</span>
          </>
        ) : (
          <span className="font-display text-[19px] font-bold">Elegí un cliente</span>
        )}
        <ChevronDown className="size-4 shrink-0 text-ink-2" strokeWidth={2.5} />
      </button>
    ) : (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 text-left transition-colors hover:border-line-strong"
      >
        {active ? (
          <>
            <ClientAvatar client={active} size={40} ring={active.attention > 0} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{active.name}</span>
              <span className="block truncate text-[13px] text-muted">@{active.handle}</span>
            </span>
          </>
        ) : (
          <span className="flex-1 px-1 text-[15px] font-semibold">Elegí un cliente</span>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted" />
      </button>
    );

  return (
    <>
      {trigger}
      <Sheet open={open} onClose={() => setOpen(false)} title="Cambiar de cliente">
        <ul className="-mx-2">
          {clients.map((c) => {
            const on = c.id === active?.id;
            return (
              <li key={c.id}>
                <button
                  onClick={() => pick(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3.5 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-sunken/70",
                    pendingId === c.id && "opacity-60",
                  )}
                >
                  <ClientAvatar client={c} size={52} ring={c.attention > 0} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">{c.handle}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
                      <span className="truncate">{c.name}</span>
                      <span className="flex items-center gap-1">
                        {c.networks.map((n) => (
                          <NetworkIcon key={n} network={n} className="size-3.5" />
                        ))}
                      </span>
                    </span>
                    {c.attention > 0 && (
                      <span className="mt-1 inline-block text-[12px] font-semibold text-accent">
                        {c.attention} {c.attention === 1 ? "pieza con cambios" : "piezas con cambios"}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border-2",
                      on ? "border-accent bg-accent text-accent-ink" : "border-line-strong",
                    )}
                  >
                    {on && <Check className="size-3.5" strokeWidth={3.5} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 space-y-1 border-t border-line pt-3">
          <button
            onClick={() => {
              setOpen(false);
              setAdding(true);
            }}
            className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3.5 rounded-2xl px-2 py-2 text-left hover:bg-sunken/70"
          >
            <span className="grid size-[52px] place-items-center rounded-full border border-dashed border-line-strong">
              <Plus className="size-5" />
            </span>
            <span className="text-[15px] font-semibold">Agregar cliente</span>
          </button>
          <Link
            href="/clientes"
            onClick={() => setOpen(false)}
            className="-mx-2 flex items-center gap-3.5 rounded-2xl px-2 py-2 text-[15px] text-ink-2 hover:bg-sunken/70"
          >
            <span className="grid size-[52px] place-items-center">
              <Settings2 className="size-5" />
            </span>
            Administrar clientes y links
          </Link>
        </div>
      </Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Nuevo cliente">
        <ClientForm onDone={() => setAdding(false)} />
      </Sheet>
    </>
  );
}
