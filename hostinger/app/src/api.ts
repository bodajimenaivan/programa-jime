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

export async function rpc<T = unknown>(fn: string, args: unknown[] = []): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url("/api/rpc.php"), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Grilla": "1" },
      body: JSON.stringify({ fn, args }),
    });
  } catch {
    throw new ApiError("Sin conexión. Revisá internet y probá de nuevo.", 0);
  }
  let body: { ok?: boolean; data?: T; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    throw new ApiError(`El servidor respondió con un error (${res.status}).`, res.status);
  }
  if (res.status === 401) {
    const here = window.location.pathname;
    if (!/\/(login|registro)$/.test(here) && !/\/p\//.test(here)) navigate("/login", { replace: true });
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
