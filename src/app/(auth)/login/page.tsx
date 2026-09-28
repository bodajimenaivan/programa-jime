import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <>
      <h1 className="font-display text-[32px] font-bold leading-tight tracking-[-0.02em]">Hola de nuevo</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-muted">Entrá para ver la grilla de tus clientes.</p>
      <AuthForm mode="login" />
    </>
  );
}
