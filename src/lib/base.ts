// Ruta base de la app. En Next es "/"; en la versión PHP (Hostinger) la inyecta index.php,
// así funciona tanto en la raíz del dominio como en una subcarpeta.
type RuntimeConfig = { base?: string; maxMb?: number; chunkMb?: number; overridePatch?: boolean };

export const runtime: RuntimeConfig =
  (typeof window !== "undefined" && (window as unknown as { __GRILLA__?: RuntimeConfig }).__GRILLA__) || {};

export const BASE = runtime.base || "/";

/** "/calendario" → "/sub/calendario" */
export function url(path: string) {
  return BASE.replace(/\/$/, "") + path;
}

/** URL completa, para compartir. */
export function absUrl(path: string) {
  return (typeof window !== "undefined" ? window.location.origin : "") + url(path);
}
