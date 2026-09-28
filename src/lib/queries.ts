import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db, schema } from "./db";
import type { Media, Post } from "./db/schema";
import { mediaUrl } from "./utils";

export type MediaDTO = {
  id: string;
  kind: "image" | "video";
  url: string;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  filename: string;
  size: number;
};

export function toMediaDTO(m: Media, share?: string): MediaDTO {
  return {
    id: m.id,
    kind: m.kind,
    url: mediaUrl(m.id, share),
    posterUrl: m.posterId ? mediaUrl(m.posterId, share) : null,
    width: m.width,
    height: m.height,
    duration: m.duration,
    filename: m.filename,
    size: m.size,
  };
}

export type PostCardDTO = Pick<Post, "id" | "title" | "format" | "status" | "date" | "time" | "networks" | "caption"> & {
  thumb: MediaDTO | null;
  mediaCount: number;
  comments: number;
};

function mediaByPost(postIds: string[]) {
  if (postIds.length === 0) return new Map<string, Media[]>();
  const rows = db
    .select()
    .from(schema.media)
    .where(and(inArray(schema.media.postId, postIds), eq(schema.media.status, "ready")))
    .orderBy(asc(schema.media.position))
    .all();
  const map = new Map<string, Media[]>();
  // Las portadas de video también llevan postId; no son piezas visibles.
  const posters = new Set(rows.map((r) => r.posterId).filter(Boolean));
  for (const r of rows) {
    if (posters.has(r.id)) continue;
    const list = map.get(r.postId!) ?? [];
    list.push(r);
    map.set(r.postId!, list);
  }
  return map;
}

export function mediaByPostFirst(postIds: string[]) {
  const map = mediaByPost(postIds);
  return new Map([...map].map(([k, v]) => [k, v[0] ? toMediaDTO(v[0]) : null]));
}

function commentCounts(postIds: string[]) {
  if (postIds.length === 0) return new Map<string, number>();
  const rows = db
    .select({ postId: schema.comments.postId, n: sql<number>`count(*)` })
    .from(schema.comments)
    .where(and(inArray(schema.comments.postId, postIds), ne(schema.comments.kind, "status")))
    .groupBy(schema.comments.postId)
    .all();
  return new Map(rows.map((r) => [r.postId, r.n]));
}

function toCards(posts: Post[], share?: string): PostCardDTO[] {
  const ids = posts.map((p) => p.id);
  const media = mediaByPost(ids);
  const comments = commentCounts(ids);
  return posts.map((p) => {
    const list = media.get(p.id) ?? [];
    return {
      id: p.id,
      title: p.title,
      caption: p.caption,
      format: p.format,
      status: p.status,
      date: p.date,
      time: p.time,
      networks: p.networks,
      thumb: list[0] ? toMediaDTO(list[0], share) : null,
      mediaCount: list.length,
      comments: comments.get(p.id) ?? 0,
    };
  });
}

export function postsInRange(clientId: string, from: string, to: string) {
  const rows = db
    .select()
    .from(schema.posts)
    .where(and(eq(schema.posts.clientId, clientId), gte(schema.posts.date, from), lte(schema.posts.date, to)))
    .orderBy(asc(schema.posts.date), asc(sql`coalesce(${schema.posts.time}, '99:99')`), asc(schema.posts.createdAt))
    .all();
  return toCards(rows);
}

/** Lo que se ve en el perfil (grilla de IG): posts, carruseles y reels. */
export function feedPosts(clientId: string, limit = 60) {
  const rows = db
    .select()
    .from(schema.posts)
    .where(and(eq(schema.posts.clientId, clientId), inArray(schema.posts.format, ["post", "carousel", "reel"])))
    .orderBy(desc(schema.posts.date), desc(sql`coalesce(${schema.posts.time}, '00:00')`))
    .limit(limit)
    .all()
    .filter((p) => p.networks.includes("instagram"));
  return toCards(rows);
}

export function getPostFull(postId: string, workspaceId: string, share?: string) {
  const post = db
    .select()
    .from(schema.posts)
    .where(and(eq(schema.posts.id, postId), eq(schema.posts.workspaceId, workspaceId)))
    .get();
  if (!post) return null;
  const media = (mediaByPost([post.id]).get(post.id) ?? []).map((m) => toMediaDTO(m, share));
  const comments = db
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.postId, post.id))
    .orderBy(asc(schema.comments.createdAt))
    .all();
  return { post, media, comments };
}

/** Piezas que el cliente ve en su link (todas; los borradores aparecen como "En preparación"). */
export function portalPosts(clientId: string, share: string) {
  const rows = db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.clientId, clientId))
    .orderBy(asc(schema.posts.date), asc(sql`coalesce(${schema.posts.time}, '99:99')`))
    .all();
  const ids = rows.map((r) => r.id);
  const media = mediaByPost(ids);
  const comments = ids.length
    ? db.select().from(schema.comments).where(inArray(schema.comments.postId, ids)).orderBy(asc(schema.comments.createdAt)).all()
    : [];
  return rows.map((post) => ({
    post,
    media: (media.get(post.id) ?? []).map((m) => toMediaDTO(m, share)),
    comments: comments.filter((c) => c.postId === post.id),
  }));
}
