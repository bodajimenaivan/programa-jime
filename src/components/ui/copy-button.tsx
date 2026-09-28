"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Respaldo para navegadores o conexiones donde el portapapeles moderno no está disponible.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/** Copia un texto con un toque y confirma con "Copiado". */
export function CopyButton({ text, label = "Copiar", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={!text.trim()}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        }
      }}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors disabled:opacity-40",
        done ? "border-st-approved bg-st-approved text-white" : "border-line bg-surface text-ink hover:border-ink",
        className,
      )}
    >
      {done ? <Check className="size-3.5" strokeWidth={3} /> : <Copy className="size-3.5" />}
      {done ? "Copiado" : label}
    </button>
  );
}
