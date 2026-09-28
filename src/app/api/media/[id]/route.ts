import fs from "node:fs";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { userFromCookieHeader } from "@/lib/auth";
import { mediaPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** El equipo accede con su sesión; el cliente, con el token de su link de aprobación (?s=). */
function canRead(media: typeof schema.media.$inferSelect, req: Request, share: string | null) {
  const user = userFromCookieHeader(req.headers.get("cookie"));
  if (user && user.workspaceId === media.workspaceId) return true;
  if (!share) return false;

  const client = db.select().from(schema.clients).where(eq(schema.clients.shareToken, share)).get();
  if (!client || client.workspaceId !== media.workspaceId) return false;
  if (client.avatarId === media.id) return true;
  if (!media.postId) return false;
  const post = db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(and(eq(schema.posts.id, media.postId), eq(schema.posts.clientId, client.id)))
    .get();
  return Boolean(post);
}

export async function GET(req: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const media = db.select().from(schema.media).where(eq(schema.media.id, id)).get();
  if (!media || media.status !== "ready") return new Response("No encontrado", { status: 404 });
  if (!canRead(media, req, url.searchParams.get("s"))) return new Response("Sin acceso", { status: 403 });

  const file = mediaPath(media.id);
  let size: number;
  try {
    size = (await fs.promises.stat(file)).size;
  } catch {
    return new Response("Archivo faltante", { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": media.mime,
    "Accept-Ranges": "bytes",
    // El contenido de un id nunca cambia.
    "Cache-Control": "private, max-age=31536000, immutable",
    ETag: `"${media.id}"`,
    "X-Content-Type-Options": "nosniff",
    // Si alguien abre el archivo directo, no puede ejecutar nada.
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
  });
  if (url.searchParams.get("download")) {
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(media.filename)}`);
  }

  if (req.headers.get("if-none-match") === `"${media.id}"`) {
    return new Response(null, { status: 304, headers });
  }

  // Los videos se piden por rangos (Safari lo exige para poder reproducir y adelantar).
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? Number(m[1]) : NaN;
    let end = m && m[2] ? Number(m[2]) : NaN;
    if (Number.isNaN(start)) {
      // bytes=-500 → últimos 500 bytes
      start = Number.isNaN(end) ? 0 : Math.max(0, size - end);
      end = size - 1;
    }
    if (Number.isNaN(end) || end >= size) end = size - 1;
    if (start >= size || start > end) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = fs.createReadStream(file, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, { status: 200, headers });
}
