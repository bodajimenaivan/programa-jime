import "server-only";
import { Server } from "@tus/server";
import { FileStore } from "@tus/file-store";
import { and, eq } from "drizzle-orm";
import { db, schema } from "./db";
import { userFromCookieHeader } from "./auth";
import { MAX_UPLOAD_BYTES, UPLOAD_DIR } from "./config";
import { formatBytes } from "./utils";

type TusRequest = { headers: Headers; method: string };

function fail(status_code: number, body: string): never {
  throw { status_code, body };
}

function authed(req: TusRequest) {
  const user = userFromCookieHeader(req.headers.get("cookie"));
  if (!user) fail(401, "Tenés que iniciar sesión para subir archivos.\n");
  return user;
}

function num(v: string | null | undefined) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function create() {
  const server = new Server({
    path: "/api/uploads",
    datastore: new FileStore({
      directory: UPLOAD_DIR,
      // Las subidas que quedan a medias se pueden retomar durante 3 días.
      expirationPeriodInMilliseconds: 3 * 24 * 3600 * 1000,
    }),
    maxSize: MAX_UPLOAD_BYTES,
    relativeLocation: true,
    respectForwardedHeaders: true,

    async onIncomingRequest(req, uploadId) {
      const user = authed(req);
      if (req.method === "POST" || req.method === "OPTIONS") return;
      const row = db
        .select({ id: schema.media.id })
        .from(schema.media)
        .where(and(eq(schema.media.id, uploadId), eq(schema.media.workspaceId, user.workspaceId)))
        .get();
      if (!row) fail(404, "Archivo no encontrado.\n");
    },

    async onUploadCreate(req, upload) {
      const user = authed(req);
      const meta = upload.metadata ?? {};
      const mime = (meta.filetype || "").toLowerCase();
      const kind = mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "image" : null;
      // SVG queda afuera: puede traer scripts.
      if (!kind || mime.includes("svg")) fail(415, "Solo se pueden subir fotos o videos.\n");
      if (upload.size && upload.size > MAX_UPLOAD_BYTES) {
        fail(413, `El archivo supera el máximo de ${formatBytes(MAX_UPLOAD_BYTES)}.\n`);
      }
      db.insert(schema.media)
        .values({
          id: upload.id,
          workspaceId: user.workspaceId,
          postId: null,
          kind,
          mime,
          filename: (meta.filename || "archivo").slice(0, 200),
          size: upload.size ?? 0,
          width: num(meta.width),
          height: num(meta.height),
          duration: num(meta.duration),
          posterId: meta.posterId || null,
          position: 0,
          status: "uploading",
          createdBy: user.id,
          createdAt: Date.now(),
        })
        .run();
      return { metadata: meta };
    },

    async onUploadFinish(_req, upload) {
      db.update(schema.media)
        .set({ status: "ready", size: upload.size ?? upload.offset })
        .where(eq(schema.media.id, upload.id))
        .run();
      return {};
    },
  });
  return server;
}

const g = globalThis as unknown as { __grillaTus?: Server };
export function tusServer() {
  return (g.__grillaTus ??= create());
}
