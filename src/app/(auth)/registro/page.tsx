import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="font-display text-[32px] font-bold leading-tight tracking-[-0.02em]">Armá tu espacio</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-muted">Después sumás a tus clientes, uno por perfil.</p>
      <AuthForm mode="register" />
    </>
  );
}
