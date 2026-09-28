"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CLIENT_COOKIE, assertClientAccess, newId, requireUser } from "@/lib/auth";
import { NETWORK_ORDER, SWATCHES } from "@/lib/constants";
import type { Network } from "@/lib/db/schema";

async function setActive(clientId: string) {
  const jar = await cookies();
  jar.set(CLIENT_COOKIE, clientId, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}

export async function switchClient(clientId: string) {
  const user = await requireUser();
  assertClientAccess(user.workspaceId, clientId);
  await setActive(clientId);
  revalidatePath("/", "layout");
}

function readNetworks(form: FormData): Network[] {
  const picked = form.getAll("networks").map(String);
  const nets = NETWORK_ORDER.filter((n) => picked.includes(n));
  return nets.length ? nets : ["instagram"];
}

function cleanHandle(raw: string, name: string) {
  const h = raw.trim().replace(/^@+/, "").replace(/\s+/g, "").toLowerCase();
  return h || name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "");
}

export type ClientFormState = { error?: string; ok?: boolean } | undefined;

export async function saveClient(_prev: ClientFormState, form: FormData): Promise<ClientFormState> {
  const user = await requireUser();
  const id = String(form.get("id") || "");
  const name = String(form.get("name") || "").trim();
  if (!name) return { error: "Poné el nombre del cliente." };
  const handle = cleanHandle(String(form.get("handle") || ""), name);
  const color = String(form.get("color") || SWATCHES[0]);
  const avatarId = String(form.get("avatarId") || "") || null;
  const networks = readNetworks(form);

  if (id) {
    assertClientAccess(user.workspaceId, id);
    db.update(schema.clients).set({ name, handle, color, networks, avatarId }).where(eq(schema.clients.id, id)).run();
    if (avatarId) attachAvatar(user.workspaceId, avatarId);
  } else {
    const newClientId = newId();
    const pos = db
      .select({ p: max(schema.clients.position) })
      .from(schema.clients)
      .where(eq(schema.clients.workspaceId, user.workspaceId))
      .get();
    db.insert(schema.clients)
      .values({
        id: newClientId,
        workspaceId: user.workspaceId,
        name,
        handle,
        color,
        avatarId,
        networks,
        shareToken: newId(18),
        position: (pos?.p ?? -1) + 1,
        createdAt: Date.now(),
      })
      .run();
    if (avatarId) attachAvatar(user.workspaceId, avatarId);
    await setActive(newClientId);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Los avatares se suben como media sin post; los marcamos para que no parezcan huérfanos. */
function attachAvatar(workspaceId: string, mediaId: string) {
  db.update(schema.media)
    .set({ postId: `avatar` })
    .where(and(eq(schema.media.id, mediaId), eq(schema.media.workspaceId, workspaceId)))
    .run();
}

export async function archiveClient(clientId: string) {
  const user = await requireUser();
  assertClientAccess(user.workspaceId, clientId);
  db.update(schema.clients).set({ archivedAt: Date.now() }).where(eq(schema.clients.id, clientId)).run();
  const jar = await cookies();
  if (jar.get(CLIENT_COOKIE)?.value === clientId) jar.delete(CLIENT_COOKIE);
  revalidatePath("/", "layout");
}

export async function resetShareLink(clientId: string) {
  const user = await requireUser();
  assertClientAccess(user.workspaceId, clientId);
  db.update(schema.clients).set({ shareToken: newId(18) }).where(eq(schema.clients.id, clientId)).run();
  revalidatePath("/", "layout");
}
