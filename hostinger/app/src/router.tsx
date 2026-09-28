// Router mínimo con History API. Las rutas son las mismas que en la versión Next.
import { useSyncExternalStore } from "react";
import { BASE, url } from "@/lib/base";

const listeners = new Set<() => void>();
let version = 0;

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("popstate", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}

/** Ruta relativa a la base: "/calendario?mes=2026-09" */
function currentPath() {
  const prefix = BASE.replace(/\/$/, "");
  let path = window.location.pathname;
  if (prefix && path.startsWith(prefix)) path = path.slice(prefix.length);
  return (path || "/") + window.location.search;
}

let snapshot = "";
function getSnapshot() {
  const next = `${currentPath()}#${version}`;
  if (next !== snapshot) snapshot = next;
  return snapshot;
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const target = url(to.startsWith("/") ? to : `/${to}`);
  if (opts.replace) window.history.replaceState(null, "", target);
  else window.history.pushState(null, "", target);
  if (!opts.replace) window.scrollTo(0, 0);
  emit();
}

/** Vuelve a pedir los datos de lo que está en pantalla (equivale a router.refresh de Next). */
export function refresh() {
  version++;
  emit();
}

export function useLocation() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const hashAt = snap.lastIndexOf("#");
  const full = snap.slice(0, hashAt);
  const q = full.indexOf("?");
  const pathname = q === -1 ? full : full.slice(0, q);
  const search = new URLSearchParams(q === -1 ? "" : full.slice(q + 1));
  return { pathname, search, full, version: Number(snap.slice(hashAt + 1)) };
}
