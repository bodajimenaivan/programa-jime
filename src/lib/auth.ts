import "server-only";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull, asc } from "drizzle-orm";
import { db, schema } from "./db";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "grilla_session";
export const CLIENT_COOKIE = "grilla_client";
const SESSION_DAYS = 30;

export function newId(bytes = 12) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64url"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt }).run();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token))).run();
  jar.delete(SESSION_COOKIE);
}

/** Busca el usuario de un token de sesión (sirve también fuera de React, p. ej. en la ruta de subidas). */
export function userFromToken(token: string | undefined | null) {
  if (!token) return null;
  const row = db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, Date.now())))
    .get();
  return row?.user ?? null;
}

export function userFromCookieHeader(header: string | null) {
  if (!header) return null;
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return userFromToken(match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null);
}

export const getUser = cache(async () => {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export const getWorkspace = cache(async (workspaceId: string) => {
  return db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get()!;
});

export const getClients = cache(async (workspaceId: string) => {
  return db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.workspaceId, workspaceId), isNull(schema.clients.archivedAt)))
    .orderBy(asc(schema.clients.position), asc(schema.clients.createdAt))
    .all();
});

/** Usuario + espacio + cliente activo (el que elegiste en el selector de cuentas). */
export const getContext = cache(async () => {
  const user = await requireUser();
  const workspace = await getWorkspace(user.workspaceId);
  const clients = await getClients(user.workspaceId);
  const jar = await cookies();
  const wanted = jar.get(CLIENT_COOKIE)?.value;
  const client = clients.find((c) => c.id === wanted) ?? clients[0] ?? null;
  return { user, workspace, clients, client };
});

/** Para páginas que necesitan sí o sí un cliente activo. */
export async function requireClient() {
  const ctx = await getContext();
  if (!ctx.client) redirect("/clientes?nuevo=1");
  return { ...ctx, client: ctx.client };
}

export function assertClientAccess(workspaceId: string, clientId: string) {
  const client = db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.id, clientId), eq(schema.clients.workspaceId, workspaceId)))
    .get();
  if (!client) throw new Error("Cliente no encontrado");
  return client;
}
