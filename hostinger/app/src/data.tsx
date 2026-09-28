import { createContext, useContext, useEffect, useState } from "react";
import { useLocation, navigate } from "./router";

type State<T> = { key: string; data?: T; error?: string };

/**
 * Pide datos a la API y los vuelve a pedir cuando cambia la clave o después de cada cambio (refresh).
 * Mientras recarga, sigue mostrando lo anterior: sin parpadeos.
 */
export function useData<T>(key: string, load: () => Promise<T>) {
  const { version } = useLocation();
  const [state, setState] = useState<State<T>>({ key: "" });

  useEffect(() => {
    let alive = true;
    load()
      .then((data) => {
        if (!alive) return;
        const redirect = (data as { redirect?: string } | null)?.redirect;
        if (redirect) navigate(redirect, { replace: true });
        else setState({ key, data });
      })
      .catch((e: Error & { status?: number }) => {
        if (!alive || e.status === 401) return;
        setState((s) => ({ key, data: s.key === key ? s.data : undefined, error: e.message }));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  return state.key === key ? state : { key, data: undefined, error: undefined };
}

export function Loading() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 250);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="grid min-h-[60dvh] place-items-center">
      {show && <span className="size-7 animate-spin rounded-full border-[3px] border-line border-t-accent" aria-label="Cargando" />}
    </div>
  );
}

export function LoadError({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-16 max-w-sm px-6 text-center">
      <p className="font-display text-[22px] font-bold">No pudimos cargar esto</p>
      <p className="mt-1 text-[15px] text-muted">{message}</p>
      <button className="btn-primary btn-sm mt-5" onClick={() => window.location.reload()}>
        Reintentar
      </button>
    </div>
  );
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Grilla` : "Grilla";
  }, [title]);
}

/* Datos del shell (usuario, clientes, cliente activo, "hoy") compartidos con las páginas. */
export type ShellData = {
  user: { name: string; email: string; color: string };
  workspaceName: string;
  timezone: string;
  today: string;
  clients: {
    id: string;
    name: string;
    handle: string;
    color: string;
    avatarId: string | null;
    networks: import("@/lib/db/schema").Network[];
    attention: number;
  }[];
  activeId: string | null;
  activeClient: import("@/lib/db/schema").Client | null;
};

export const ShellDataContext = createContext<ShellData | null>(null);
export function useShellData() {
  const d = useContext(ShellDataContext);
  if (!d) throw new Error("ShellData fuera del layout");
  return d;
}
