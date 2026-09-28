"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createSession, destroySession, hashPassword, newId, verifyPassword } from "@/lib/auth";
import { DEFAULT_TIMEZONE } from "@/lib/config";
import { SWATCHES } from "@/lib/constants";

export type AuthState = { error?: string; email?: string } | undefined;

export async function login(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  if (!email || !password) return { error: "Completá email y contraseña.", email };

  const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "El email o la contraseña no coinciden.", email };
  }
  await createSession(user.id);
  redirect("/calendario");
}

export async function register(_prev: AuthState, form: FormData): Promise<AuthState> {
  const name = String(form.get("name") || "").trim();
  const agency = String(form.get("agency") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  if (!name || !email || !password) return { error: "Completá todos los campos.", email };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Ese email no parece válido.", email };
  if (password.length < 8) return { error: "La contraseña necesita al menos 8 caracteres.", email };

  const exists = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).get();
  if (exists) return { error: "Ya hay una cuenta con ese email. Probá iniciar sesión.", email };

  const now = Date.now();
  const workspaceId = newId();
  const userId = newId();
  const passwordHash = await hashPassword(password);
  db.transaction((tx) => {
    tx.insert(schema.workspaces)
      .values({ id: workspaceId, name: agency || `Equipo de ${name.split(" ")[0]}`, timezone: DEFAULT_TIMEZONE, createdAt: now })
      .run();
    tx.insert(schema.users)
      .values({ id: userId, workspaceId, name, email, passwordHash, color: SWATCHES[0], role: "owner", createdAt: now })
      .run();
  });
  await createSession(userId);
  redirect("/clientes?nuevo=1");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
