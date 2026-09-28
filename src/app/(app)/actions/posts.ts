"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertClientAccess, newId, requireUser } from "@/lib/auth";
import { FORMAT_ORDER, NETWORK_ORDER, STATUS_LABEL, STATUS_ORDER } from "@/lib/constants";
import type { Network, PostFormat, PostMetrics, PostStatus } from "@/lib/db/schema";
import crypto from "node:crypto";
import fs from "node:fs";
import { deleteMedia, mediaPath } from "@/lib/storage";

export type PostInput = {
  id?: string;
  clientId: string;
  title: string;
  caption: string;
  format: PostFormat;
  networks: Network[];
  date: string;
  time: string | null;
  status: PostStatus;
  notes: string;
  mediaIds: string[];
  assigneeId?: string | null;
};

function ownPost(workspaceId: string, id: string) {
  const post = db
    .select()
    .from(schema.posts)
    .where(and(eq(schema.posts.id, id), eq(schema.posts.workspaceId, workspaceId)))
    .get();
  if (!post) throw new Error("Pieza no encontrada");
  return post;
}

export async function savePost(input: PostInput): Promise<{ id: string } | { error: string }> {
  const user = await requireUser();
  assertClientAccess(user.workspaceId, input.clientId);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Elegí una fecha." };
  if (input.time && !/^\d{2}:\d{2}$/.test(input.time)) return { error: "La hora no es válida." };
  if (!FORMAT_ORDER.includes(input.format)) return { error: "Formato inválido." };
  if (!STATUS_ORDER.includes(input.status)) return { error: "Estado inválido." };
  const networks = NETWORK_ORDER.filter((n) => input.networks.includes(n));
  if (networks.length === 0) return { error: "Elegí al menos una red." };

  const now = Date.now();
  const title = input.title.trim() || "Sin título";
  const assigneeId =
    input.assigneeId &&
    db
      .select({ id: schema.team.id })
      .from(schema.team)
      .where(and(eq(schema.team.id, input.assigneeId), eq(schema.team.workspaceId, user.workspaceId)))
      .get()
      ? input.assigneeId
      : null;
  let id = input.id;
  let prevStatus: PostStatus | null = null;

  // Solo se pueden adjuntar archivos propios que estén libres o ya en esta pieza.
  const mediaIds = [...new Set(input.mediaIds)];
  const valid = mediaIds.length
    ? db
        .select()
        .from(schema.media)
        .where(
          and(
            eq(schema.media.workspaceId, user.workspaceId),
            inArray(schema.media.id, mediaIds),
            eq(schema.media.status, "ready"),
            id ? or(isNull(schema.media.postId), eq(schema.media.postId, id)) : isNull(schema.media.postId),
          ),
        )
        .all()
    : [];
  const ordered = mediaIds.filter((m) => valid.some((v) => v.id === m));

  let removed: string[] = [];
  db.transaction((tx) => {
    if (id) {
      const existing = ownPost(user.workspaceId, id);
      prevStatus = existing.status;
      tx.update(schema.posts)
        .set({
          clientId: input.clientId,
          title,
          caption: input.caption,
          format: input.format,
          networks,
          date: input.date,
          time: input.time || null,
          status: input.status,
          notes: input.notes,
          assigneeId,
          updatedAt: now,
        })
        .where(eq(schema.posts.id, id))
        .run();
      const current = tx.select({ id: schema.media.id, posterId: schema.media.posterId }).from(schema.media).where(eq(schema.media.postId, id)).all();
      const posterIds = new Set(current.map((c) => c.posterId));
      removed = current.filter((c) => !ordered.includes(c.id) && !posterIds.has(c.id)).map((c) => c.id);
    } else {
      id = newId();
      tx.insert(schema.posts)
        .values({
          id,
          workspaceId: user.workspaceId,
          clientId: input.clientId,
          title,
          caption: input.caption,
          format: input.format,
          networks,
          date: input.date,
          time: input.time || null,
          status: input.status,
          notes: input.notes,
          postMetrics: null,
          assigneeId,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
    ordered.forEach((mid, position) => {
      tx.update(schema.media).set({ postId: id!, position }).where(eq(schema.media.id, mid)).run();
      const posterId = valid.find((v) => v.id === mid)?.posterId;
      if (posterId) {
        tx.update(schema.media)
          .set({ postId: id! })
          .where(and(eq(schema.media.id, posterId), eq(schema.media.workspaceId, user.workspaceId)))
          .run();
      }
    });
    if (prevStatus !== input.status && prevStatus !== null) {
      tx.insert(schema.comments)
        .values({
          id: newId(),
          postId: id!,
          authorKind: "team",
          authorName: user.name,
          userId: user.id,
          kind: "status",
          body: STATUS_LABEL[input.status],
          createdAt: now,
        })
        .run();
    }
  });
  deleteMedia(user.workspaceId, removed);

  revalidatePath("/", "layout");
  return { id: id! };
}

export async function deletePost(id: string) {
  const user = await requireUser();
  ownPost(user.workspaceId, id);
  const files = db.select({ id: schema.media.id }).from(schema.media).where(eq(schema.media.postId, id)).all();
  db.delete(schema.posts).where(eq(schema.posts.id, id)).run();
  db.update(schema.tasks).set({ postId: null }).where(eq(schema.tasks.postId, id)).run();
  deleteMedia(
    user.workspaceId,
    files.map((f) => f.id),
  );
  revalidatePath("/", "layout");
}

export async function movePost(id: string, date: string) {
  const user = await requireUser();
  ownPost(user.workspaceId, id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Fecha inválida");
  db.update(schema.posts).set({ date, updatedAt: Date.now() }).where(eq(schema.posts.id, id)).run();
  revalidatePath("/", "layout");
}

export async function setPostStatus(id: string, status: PostStatus) {
  const user = await requireUser();
  const post = ownPost(user.workspaceId, id);
  if (!STATUS_ORDER.includes(status) || post.status === status) return;
  db.update(schema.posts).set({ status, updatedAt: Date.now() }).where(eq(schema.posts.id, id)).run();
  db.insert(schema.comments)
    .values({
      id: newId(),
      postId: id,
      authorKind: "team",
      authorName: user.name,
      userId: user.id,
      kind: "status",
      body: STATUS_LABEL[status],
      createdAt: Date.now(),
    })
    .run();
  revalidatePath("/", "layout");
}

export async function addTeamComment(postId: string, body: string) {
  const user = await requireUser();
  ownPost(user.workspaceId, postId);
  const text = body.trim().slice(0, 4000);
  if (!text) return;
  db.insert(schema.comments)
    .values({
      id: newId(),
      postId,
      authorKind: "team",
      authorName: user.name,
      userId: user.id,
      kind: "comment",
      body: text,
      createdAt: Date.now(),
    })
    .run();
  revalidatePath(`/posts/${postId}`);
}

export async function savePostMetrics(postId: string, metrics: PostMetrics) {
  const user = await requireUser();
  ownPost(user.workspaceId, postId);
  const clean = Object.fromEntries(
    (["reach", "likes", "comments", "saves", "shares", "views"] as const).map((k) => [k, Math.max(0, Math.round(Number(metrics[k]) || 0))]),
  ) as PostMetrics;
  db.update(schema.posts).set({ postMetrics: clean, updatedAt: Date.now() }).where(eq(schema.posts.id, postId)).run();
  revalidatePath("/", "layout");
}

export async function duplicatePost(id: string) {
  const user = await requireUser();
  const post = ownPost(user.workspaceId, id);
  const newPostId = newId();
  const now = Date.now();
  db.insert(schema.posts)
    .values({
      ...post,
      id: newPostId,
      title: `${post.title} (copia)`,
      status: "draft",
      postMetrics: null,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Los archivos se duplican con hard links: instantáneo aunque el video pese 1 GB.
  const files = db.select().from(schema.media).where(eq(schema.media.postId, id)).all();
  const idMap = new Map(files.map((f) => [f.id, crypto.randomBytes(16).toString("hex")]));
  for (const f of files) {
    const target = mediaPath(idMap.get(f.id)!);
    try {
      fs.linkSync(mediaPath(f.id), target);
    } catch {
      fs.copyFileSync(mediaPath(f.id), target);
    }
  }
  for (const f of files) {
    db.insert(schema.media)
      .values({
        ...f,
        id: idMap.get(f.id)!,
        postId: newPostId,
        posterId: f.posterId ? (idMap.get(f.posterId) ?? null) : null,
        createdBy: user.id,
        createdAt: now,
      })
      .run();
  }

  revalidatePath("/", "layout");
  return { id: newPostId };
}
