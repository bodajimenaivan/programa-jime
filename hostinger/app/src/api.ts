// Cliente de la API PHP: cada función del servidor se llama con rpc("nombre", [...args]).
import { url } from "@/lib/base";
import { navigate, refresh } from "./router";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Pedidos que solo leen: si el hosting falla un instante, se pueden repetir sin riesgo.
const READS = new Set([
  "me", "setupState", "login", "shell", "clientsPage", "calendarData", "postPage", "teamPage",
  "tasksPage", "metricsData", "portalPage", "hashtagData",
]);
// Respuestas del hosting cuando está saturado: el pedido no llegó a procesarse.
const BUSY = new Set([429, 503, 508]);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cambia en cada login: un "no tenés sesión" de un pedido viejo no te saca después de entrar.
let authEpoch = 0;
export const markLoggedIn = () => void authEpoch++;

async function send(fn: string, args: unknown[]) {
  const retryable = READS.has(fn);
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(url("/api/rpc.php"), {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "X-Grilla": "1" },
        body: JSON.stringify({ fn, args }),
      });
    } catch {
      res = null;
    }
    const transient = res === null ? retryable : BUSY.has(res.status) || (retryable && res.status >= 500);
    if (!transient || attempt >= 2) {
      if (!res) throw new ApiError("Sin conexión. Revisá internet y probá de nuevo.", 0);
      return res;
    }
    await wait(600 * (attempt + 1));
  }
}

export async function rpc<T = unknown>(fn: string, args: unknown[] = []): Promise<T> {
  const epoch = authEpoch;
  const res = await send(fn, args);
  let body: { ok?: boolean; data?: T; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    throw new ApiError(
      res.status >= 500 ? "El servidor está ocupado. Esperá unos segundos y probá de nuevo." : `El servidor respondió con un error (${res.status}).`,
      res.status,
    );
  }
  if (res.status === 401) {
    const here = window.location.pathname;
    if (epoch === authEpoch && !/\/(login|registro)$/.test(here) && !/\/p\//.test(here)) navigate("/login", { replace: true });
    throw new ApiError(body.error || "Tenés que iniciar sesión.", 401);
  }
  if (!res.ok || !body.ok) throw new ApiError(body.error || "Algo salió mal.", res.status);
  return body.data as T;
}

/** Para mutaciones: llama y después refresca lo que está en pantalla (como revalidatePath). */
export async function mutate<T = unknown>(fn: string, args: unknown[] = []): Promise<T> {
  const data = await rpc<T>(fn, args);
  refresh();
  return data;
}
