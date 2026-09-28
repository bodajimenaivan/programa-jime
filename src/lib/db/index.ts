import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { DATA_DIR } from "../config";
import { ALTERS, MIGRATION, TEAM_BACKFILL } from "./migration";


type DB = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

function open(): DB {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(path.join(DATA_DIR, "grilla.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.exec(MIGRATION);
  for (const sql of ALTERS) {
    try {
      sqlite.exec(sql);
    } catch {
      // ya existe
    }
  }
  sqlite.exec(TEAM_BACKFILL);
  return drizzle(sqlite, { schema });
}

// Un solo handle por proceso (sobrevive al hot reload en desarrollo).
const g = globalThis as unknown as { __grillaDb?: DB };
export const db: DB = g.__grillaDb ?? (g.__grillaDb = open());

export { schema };
