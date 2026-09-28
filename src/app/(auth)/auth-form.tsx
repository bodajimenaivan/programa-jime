"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, register, type AuthState } from "./actions";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : register, undefined);

  return (
    <form action={action} className="space-y-4">
      {mode === "register" && (
        <>
          <div>
            <label className="label" htmlFor="name">Tu nombre</label>
            <input className="field" id="name" name="name" autoComplete="name" required />
          </div>
          <div>
            <label className="label" htmlFor="agency">
              Agencia o marca personal <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input className="field" id="agency" name="agency" autoComplete="organization" />
          </div>
        </>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input
          className="field"
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={state?.email}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input
          className="field"
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "register" ? 8 : undefined}
          required
        />
      </div>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[14px] text-ink">
          {state.error}
        </p>
      )}

      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Un segundo…" : mode === "login" ? "Entrar" : "Crear cuenta"}
      </button>

      <p className="pt-2 text-center text-[14px] text-muted">
        {mode === "login" ? (
          <>
            ¿Primera vez?{" "}
            <Link href="/registro" className="font-semibold text-ink underline decoration-line-strong underline-offset-4">
              Creá tu cuenta
            </Link>
          </>
        ) : (
          <>
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="font-semibold text-ink underline decoration-line-strong underline-offset-4">
              Iniciá sesión
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
