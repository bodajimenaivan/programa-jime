"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/auth";

type Kind = "approved" | "changes" | "comment";

/** Lo que hace el cliente desde su link (sin cuenta, con el token secreto). */
export async function clientFeedback(token: string, postId: string, kind: Kind, name: string, body: string) {
  const client = db.select().from(schema.clients).where(eq(schema.clients.shareToken, token)).get();
  if (!client || client.archivedAt) return { error: "El link ya no es válido." };
  const post = db
    .select()
    .from(schema.posts)
    .where(and(eq(schema.posts.id, postId), eq(schema.posts.clientId, client.id)))
    .get();
  if (!post) return { error: "No encontramos esa pieza." };

  const author = name.trim().slice(0, 60) || client.name;
  const text = body.trim().slice(0, 4000);
  if (kind === "comment" && !text) return { error: "Escribí algo antes de enviar." };
  if (kind === "changes" && !text) return { error: "Contanos qué te gustaría cambiar." };
  if (kind !== "comment" && post.status === "draft") return { error: "Esta pieza todavía está en preparación." };
  if (kind !== "comment" && (post.status === "published" || post.status === "scheduled")) {
    return { error: "Esta pieza ya está programada o publicada." };
  }

  const now = Date.now();
  db.transaction((tx) => {
    tx.insert(schema.comments)
      .values({ id: newId(), postId, authorKind: "client", authorName: author, userId: null, kind, body: text, createdAt: now })
      .run();
    if (kind !== "comment") {
      tx.update(schema.posts).set({ status: kind, updatedAt: now }).where(eq(schema.posts.id, postId)).run();
    }
  });

  revalidatePath(`/p/${token}`);
  revalidatePath("/", "layout");
  return { ok: true };
}
