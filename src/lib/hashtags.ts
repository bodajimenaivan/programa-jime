// Hashtags: leerlos del texto, sumarlos/sacarlos y medir cuáles rinden mejor.
// Lo usan el servidor Next y la versión PHP (que hace el cálculo en el navegador).
import type { PostMetrics } from "./db/schema";

const TAG_RE = /#[\p{L}\p{N}_]+/gu;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Hashtags de un texto, sin repetir (Instagram no distingue mayúsculas). */
export function extractHashtags(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.match(TAG_RE) ?? []) {
    const key = m.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

/** "Café de especialidad" → "#cafedeespecialidad". */
export function toHashtag(raw: string) {
  const clean = raw.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}_]/gu, "").toLowerCase();
  return clean ? `#${clean}` : "";
}

export function hasTag(text: string, tag: string) {
  const key = tag.toLowerCase();
  return extractHashtags(text).some((t) => t.toLowerCase() === key);
}

/** Suma el hashtag al final: en la misma línea si el texto ya termina con hashtags, si no en un párrafo aparte. */
export function addTag(text: string, tag: string) {
  if (hasTag(text, tag)) return text;
  const body = text.replace(/\s+$/, "");
  if (!body) return tag;
  const lastLine = body.slice(body.lastIndexOf("\n") + 1);
  const onlyTags = /^\s*(#[\p{L}\p{N}_]+\s*)+$/u.test(lastLine);
  return body + (onlyTags ? " " : "\n\n") + tag;
}

export function removeTag(text: string, tag: string) {
  const re = new RegExp(`[ \\t]*${escape(tag)}(?![\\p{L}\\p{N}_])`, "giu");
  return text
    .replace(re, "")
    .replace(/^[ \t]+(?=#)/gm, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+$/, "");
}

export const toggleTag = (text: string, tag: string) => (hasTag(text, tag) ? removeTag(text, tag) : addTag(text, tag));

/* ---------------- Rendimiento ---------------- */

export type TagSource = { caption: string; date: string; postMetrics: PostMetrics | null };

export type TagStat = {
  tag: string;
  /** En cuántas piezas se usó. */
  uses: number;
  /** Fecha de la última pieza que lo tuvo. */
  last: string;
  /** Cuántas de esas piezas tienen resultados cargados. */
  measured: number;
  /** Tasa de interacción promedio de esas piezas (interacciones / alcance). */
  rate: number | null;
  /** Cuánto más (o menos) rinde que el promedio del cliente: 0.25 = +25 %. */
  lift: number | null;
};

export type TagStats = { tags: TagStat[]; baseline: number | null; measured: number };

/** Con menos piezas medidas que esto no decimos si un hashtag "rinde". */
export const MIN_MEASURED = 2;

const rateOf = (m: PostMetrics) => (m.reach > 0 ? (m.likes + m.comments + m.saves + m.shares) / m.reach : null);
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

export function hashtagStats(posts: TagSource[]): TagStats {
  const acc = new Map<string, { forms: Map<string, number>; uses: number; last: string; rates: number[] }>();
  const all: number[] = [];
  for (const p of posts) {
    const r = p.postMetrics ? rateOf(p.postMetrics) : null;
    if (r !== null) all.push(r);
    for (const t of extractHashtags(p.caption ?? "")) {
      const key = t.toLowerCase();
      const a = acc.get(key) ?? { forms: new Map<string, number>(), uses: 0, last: "", rates: [] as number[] };
      a.forms.set(t, (a.forms.get(t) ?? 0) + 1);
      a.uses++;
      if (p.date > a.last) a.last = p.date;
      if (r !== null) a.rates.push(r);
      acc.set(key, a);
    }
  }
  const baseline = all.length ? avg(all) : null;
  const tags = [...acc.values()]
    .map((a) => {
      const rate = a.rates.length ? avg(a.rates) : null;
      return {
        // La forma más usada (respeta #CafeDeEspecialidad si así lo escribís).
        tag: [...a.forms].sort((x, y) => y[1] - x[1])[0][0],
        uses: a.uses,
        last: a.last,
        measured: a.rates.length,
        rate,
        lift: rate !== null && baseline ? rate / baseline - 1 : null,
      };
    })
    .sort((a, b) => b.uses - a.uses || b.last.localeCompare(a.last));
  return { tags, baseline, measured: all.length };
}

/** Los que mejor rinden, solo entre los que tienen suficientes piezas medidas. */
export function bestTags(stats: TagStats, n = 10) {
  return stats.tags
    .filter((t) => t.measured >= MIN_MEASURED && t.lift !== null)
    .sort((a, b) => b.lift! - a.lift! || b.measured - a.measured)
    .slice(0, n);
}

/** 0.136 → "13,6 %" */
export const formatRate = (r: number) => `${(r * 100).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

export function formatLift(lift: number) {
  const pct = Math.round(lift * 100);
  return pct === 0 ? "igual al promedio" : `${pct > 0 ? "+" : "−"}${Math.abs(pct)} %`;
}

/* ---------------- Dónde buscar ---------------- */

/** Páginas que miden hashtags en vivo; se abren con la palabra ya buscada. */
export function hashtagSites(word: string) {
  const w = encodeURIComponent(toHashtag(word).slice(1));
  return [
    {
      name: "Best Hashtags",
      hint: "Los más usados con esa palabra, listos para copiar",
      href: `https://best-hashtags.com/hashtag/${w}/`,
    },
    {
      name: "Top Hashtags",
      hint: "Cuántas publicaciones tiene cada uno",
      href: `https://top-hashtags.com/hashtag/${w}/`,
    },
    {
      name: "Instagram",
      hint: "Qué se está publicando con ese hashtag",
      href: `https://www.instagram.com/explore/tags/${w}/`,
    },
    {
      name: "TikTok · Tendencias",
      hint: "Los hashtags en tendencia de la semana (elegí Argentina)",
      href: "https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en",
    },
  ];
}
