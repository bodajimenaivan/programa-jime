import path from "node:path";

// turbopackIgnore: la carpeta de datos (con videos de hasta 1 GB) nunca debe entrar al build.
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || "./data");
export const UPLOAD_DIR = path.join(/*turbopackIgnore: true*/ DATA_DIR, "uploads");
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 1024) * 1024 * 1024;
export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || "America/Argentina/Buenos_Aires";
