"use client";

import { Download, Film, ImageIcon } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

export type DownloadFile = { id: string; url: string; filename: string; size: number; kind: "image" | "video" };

/** Agrega ?download=1 para que el servidor lo mande como archivo (con su nombre original). */
export function downloadUrl(url: string) {
  if (url.startsWith("blob:")) return url;
  return url + (url.includes("?") ? "&" : "?") + "download=1";
}

function trigger(file: DownloadFile) {
  const a = document.createElement("a");
  a.href = downloadUrl(file.url);
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Lista de archivos originales con botón de descarga (equipo y cliente). */
export function MediaDownloads({ files, className }: { files: DownloadFile[]; className?: string }) {
  if (files.length === 0) return null;
  const total = files.reduce((a, f) => a + f.size, 0);
  return (
    <div className={cn("rounded-2xl border border-line bg-surface", className)}>
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
        <p className="text-[13px] font-semibold text-ink-2">
          {files.length === 1 ? "Archivo original" : `${files.length} archivos originales`}
          <span className="font-normal text-muted"> · {formatBytes(total)}</span>
        </p>
        {files.length > 1 && (
          <button
            type="button"
            className="text-[13px] font-semibold text-ink underline decoration-line-strong underline-offset-4"
            onClick={() => files.forEach((f, i) => setTimeout(() => trigger(f), i * 600))}
          >
            Descargar todo
          </button>
        )}
      </div>
      <ul className="px-2 pb-2">
        {files.map((f) => (
          <li key={f.id}>
            <a
              href={downloadUrl(f.url)}
              download={f.filename}
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-sunken/70"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-ink-2">
                {f.kind === "video" ? <Film className="size-4" /> : <ImageIcon className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{f.filename}</span>
                <span className="block text-[12px] text-muted">{formatBytes(f.size)}</span>
              </span>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-inverse text-inverse-ink" aria-label={`Descargar ${f.filename}`}>
                <Download className="size-4" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
