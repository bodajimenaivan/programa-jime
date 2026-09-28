export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1).replace(".", ",") : Math.round(v)}\u00a0${units[i]}`;
}

/** 1.234 · 16,5 k · 2,1 M (con espacio duro para que la unidad no quede sola en otra línea). */
export function formatNumber(n: number) {
  const short = (v: number, unit: string) => `${v.toFixed(1).replace(/\.0$/, "").replace(".", ",")}\u00a0${unit}`;
  if (Math.abs(n) >= 1_000_000) return short(n / 1_000_000, "M");
  if (Math.abs(n) >= 10_000) return short(n / 1000, "k");
  return Math.round(n).toLocaleString("es-AR");
}

export function formatDuration(sec: number) {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function mediaUrl(id: string, share?: string) {
  return share ? `/api/media/${id}?s=${encodeURIComponent(share)}` : `/api/media/${id}`;
}
