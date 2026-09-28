import type { Network, PostFormat, PostStatus, TaskStatus } from "./db/schema";

export const FORMAT_LABEL: Record<PostFormat, string> = {
  post: "Post",
  carousel: "Carrusel",
  reel: "Reel",
  story: "Historia",
  tiktok: "TikTok",
};

export const FORMAT_ORDER: PostFormat[] = ["post", "carousel", "reel", "story", "tiktok"];

/** Relación de aspecto de la vista previa (ancho / alto). */
export const FORMAT_RATIO: Record<PostFormat, number> = {
  post: 4 / 5,
  carousel: 4 / 5,
  reel: 9 / 16,
  story: 9 / 16,
  tiktok: 9 / 16,
};

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Borrador",
  review: "Para aprobar",
  changes: "Con cambios",
  approved: "Aprobado",
  scheduled: "Programado",
  published: "Publicado",
};

export const STATUS_ORDER: PostStatus[] = ["draft", "review", "changes", "approved", "scheduled", "published"];

export const NETWORK_LABEL: Record<Network, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  linkedin: "LinkedIn",
};

export const NETWORK_ORDER: Network[] = ["instagram", "tiktok", "facebook", "linkedin"];

export const TASK_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "Por hacer" },
  { id: "doing", label: "En curso" },
  { id: "review", label: "En revisión" },
  { id: "done", label: "Listo" },
];

export const PRIORITY_LABEL = { low: "Baja", normal: "Normal", high: "Alta" } as const;

/** Paleta para avatares de clientes y personas. */
export const SWATCHES = ["#7E8C69", "#C9687D", "#5E6A4C", "#B07F72", "#5F7C9E", "#94607A", "#4F7A6B", "#B8844A"];

export const CAPTION_LIMIT = 2200;
