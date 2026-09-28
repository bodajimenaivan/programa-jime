import "server-only";
import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "./db";
import { UPLOAD_DIR } from "./config";

export function mediaPath(id: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("id inválido");
  return path.join(UPLOAD_DIR, id);
}

/** Borra archivos (y sus portadas) del disco y de la base. */
export function deleteMedia(workspaceId: string, ids: string[]) {
  if (ids.length === 0) return;
  const rows = db
    .select({ id: schema.media.id, posterId: schema.media.posterId })
    .from(schema.media)
    .where(and(eq(schema.media.workspaceId, workspaceId), inArray(schema.media.id, ids)))
    .all();
  const all = new Set<string>();
  for (const r of rows) {
    all.add(r.id);
    if (r.posterId) all.add(r.posterId);
  }
  const list = [...all];
  if (list.length === 0) return;
  db.delete(schema.media)
    .where(and(eq(schema.media.workspaceId, workspaceId), inArray(schema.media.id, list)))
    .run();
  for (const id of list) {
    for (const f of [mediaPath(id), `${mediaPath(id)}.json`]) {
      fs.rm(f, { force: true }, () => {});
    }
  }
}
