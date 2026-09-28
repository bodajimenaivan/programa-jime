import { rpc } from "../api";
import { navigate } from "../router";

export type AuthState = { error?: string; email?: string } | undefined;

export async function login(_prev: AuthState, form: FormData): Promise<AuthState> {
  try {
    const res = await rpc<{ ok?: boolean; error?: string; email?: string }>("login", [String(form.get("email") ?? ""), String(form.get("password") ?? "")]);
    if (res.error) return res;
    navigate("/calendario", { replace: true });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo entrar.", email: String(form.get("email") ?? "") };
  }
}

export async function register(_prev: AuthState, form: FormData): Promise<AuthState> {
  try {
    const res = await rpc<{ ok?: boolean; error?: string; email?: string }>("register", [
      String(form.get("name") ?? ""),
      String(form.get("agency") ?? ""),
      String(form.get("email") ?? ""),
      String(form.get("password") ?? ""),
    ]);
    if (res.error) return res;
    navigate("/clientes?nuevo=1", { replace: true });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear la cuenta.", email: String(form.get("email") ?? "") };
  }
}

export async function logout() {
  await rpc("logout").catch(() => {});
  navigate("/login", { replace: true });
}
