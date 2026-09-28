"use client";

import * as tus from "tus-js-client";

export const MAX_UPLOAD_BYTES = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 1024) * 1024 * 1024;
const CHUNK = 8 * 1024 * 1024;

export type Probe = { width?: number; height?: number; duration?: number; poster?: Blob };

/** Lee dimensiones (y para videos, duración + un cuadro de portada) sin subir nada. */
export async function probeFile(file: File): Promise<Probe> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => {});
      return img.naturalWidth ? { width: img.naturalWidth, height: img.naturalHeight } : {};
    }
    if (file.type.startsWith("video/")) {
      return await probeVideo(url);
    }
    return {};
  } finally {
    // Pequeña demora: el <img>/<video> puede seguir leyendo mientras resolvemos.
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

function probeVideo(url: string): Promise<Probe> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    const done = (p: Probe) => {
      v.removeAttribute("src");
      v.load();
      resolve(p);
    };
    const timer = setTimeout(() => done({}), 15000);
    v.addEventListener("error", () => {
      clearTimeout(timer);
      done({});
    });
    v.addEventListener("loadedmetadata", () => {
      const base = { width: v.videoWidth || undefined, height: v.videoHeight || undefined, duration: v.duration || undefined };
      v.currentTime = Math.min(1, (v.duration || 0) / 3);
      v.addEventListener(
        "seeked",
        () => {
          clearTimeout(timer);
          try {
            const scale = Math.min(1, 720 / (v.videoWidth || 720));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round((v.videoWidth || 720) * scale);
            canvas.height = Math.round((v.videoHeight || 1280) * scale);
            canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => done({ ...base, poster: blob ?? undefined }), "image/jpeg", 0.82);
          } catch {
            done(base);
          }
        },
        { once: true },
      );
    });
  });
}

export type UploadHandle = { promise: Promise<string>; abort: () => void };

/** Sube un archivo por partes con tus. Si se corta, reintenta y retoma desde donde quedó. */
export function uploadFile(
  file: Blob,
  meta: Record<string, string>,
  onProgress?: (sent: number, total: number) => void,
): UploadHandle {
  let upload: tus.Upload;
  const promise = new Promise<string>((resolve, reject) => {
    upload = new tus.Upload(file, {
      endpoint: "/api/uploads",
      chunkSize: CHUNK,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      removeFingerprintOnSuccess: true,
      metadata: meta,
      onProgress: (sent, total) => onProgress?.(sent, total),
      onError: (err) => {
        const body = (err as tus.DetailedError).originalResponse?.getBody?.();
        reject(new Error(body?.trim() || "No se pudo subir el archivo."));
      },
      onSuccess: () => {
        const id = upload.url!.split("/").pop()!;
        resolve(id);
      },
    });
    upload
      .findPreviousUploads()
      .then((prev) => {
        if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
        upload.start();
      })
      .catch(() => upload.start());
  });
  return { promise, abort: () => void upload?.abort(true) };
}

/** Portada (si es video) + archivo. Devuelve el id del archivo subido. */
export async function uploadMedia(file: File, onProgress?: (fraction: number) => void) {
  const probe = await probeFile(file);
  const meta: Record<string, string> = { filename: file.name, filetype: file.type || guessType(file.name) };
  if (probe.width) meta.width = String(probe.width);
  if (probe.height) meta.height = String(probe.height);
  if (probe.duration) meta.duration = String(probe.duration);
  if (probe.poster) {
    meta.posterId = await uploadFile(probe.poster, { filename: "portada.jpg", filetype: "image/jpeg" }).promise;
  }
  return { probe, handle: uploadFile(file, meta, (s, t) => onProgress?.(t ? s / t : 0)) };
}

export function guessType(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4v: "video/mp4",
    webm: "video/webm",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
  };
  return (ext && map[ext]) || "application/octet-stream";
}
