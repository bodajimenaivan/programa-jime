"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { HASHTAG_IDEAS } from "@/lib/hashtag-ideas";
import {
  MIN_MEASURED,
  addTag,
  bestTags,
  extractHashtags,
  formatLift,
  formatRate,
  hasTag,
  hashtagSites,
  toHashtag,
  toggleTag,
  type TagStats,
} from "@/lib/hashtags";
import { hashtagData } from "@/app/(app)/actions/posts";

type Tab = "cliente" | "ideas" | "buscar";

function readStore(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** Hashtags para el texto: los que ya usaste con el cliente (y cuánto rinden), ideas por rubro y dónde buscar tendencias. */
export function HashtagPanel({
  caption,
  onChange,
  maxLength,
  clientId,
  handle,
}: {
  caption: string;
  onChange: (v: string) => void;
  maxLength: number;
  clientId: string;
  handle: string;
}) {
  const [tab, setTab] = useState<Tab>("cliente");
  // Se vuelve a pedir cada vez que se abre el panel, así incluye lo último que guardaste.
  const [cache] = useState(() => new Map<string, Promise<TagStats>>());
  const apply = (next: string) => {
    if (next.length <= maxLength) onChange(next);
  };
  const toggle = (tag: string) => apply(toggleTag(caption, tag));

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_12px_32px_-18px_rgb(0_0_0/0.35)]">
      <div className="grid grid-cols-3 gap-1 border-b border-line p-1.5" role="tablist">
        {(
          [
            ["cliente", "Tus hashtags"],
            ["ideas", "Ideas"],
            ["buscar", "Tendencias"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "h-9 rounded-xl text-[13.5px] font-semibold transition-colors",
              tab === id ? "bg-inverse text-inverse-ink" : "text-ink-2 hover:bg-sunken",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="max-h-[380px] overflow-y-auto overscroll-contain p-3.5">
        {tab === "cliente" && <ClientTab cache={cache} clientId={clientId} handle={handle} caption={caption} toggle={toggle} goIdeas={() => setTab("ideas")} />}
        {tab === "ideas" && <IdeasTab clientId={clientId} handle={handle} caption={caption} toggle={toggle} />}
        {tab === "buscar" && <SearchTab caption={caption} toggle={toggle} addAll={(tags) => apply(tags.reduce(addTag, caption))} />}
      </div>
    </div>
  );
}

function TagChip({ tag, on, onClick, meta }: { tag: string; on: boolean; onClick: () => void; meta?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border pr-3 pl-2.5 text-[13.5px] font-medium transition-colors",
        on ? "border-inverse bg-inverse text-inverse-ink" : "border-line bg-surface text-ink hover:border-ink",
      )}
    >
      {on ? <Check className="size-3.5 shrink-0" strokeWidth={3} /> : <Plus className="size-3.5 shrink-0 text-muted" strokeWidth={2.5} />}
      <span className="truncate">{tag}</span>
      {meta}
    </button>
  );
}

function Heading({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2">
      <p className="text-[13px] font-semibold">{children}</p>
      {hint && <p className="text-[12.5px] text-muted">{hint}</p>}
    </div>
  );
}

function ClientTab({
  cache,
  clientId,
  handle,
  caption,
  toggle,
  goIdeas,
}: {
  cache: Map<string, Promise<TagStats>>;
  clientId: string;
  handle: string;
  caption: string;
  toggle: (t: string) => void;
  goIdeas: () => void;
}) {
  const [stats, setStats] = useState<TagStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setStats(null);
    setError(false);
    if (!cache.has(clientId)) cache.set(clientId, hashtagData(clientId));
    cache.get(clientId)!.then(
      (s) => alive && setStats(s),
      () => {
        cache.delete(clientId);
        if (alive) setError(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [cache, clientId]);

  if (error) return <p className="py-4 text-center text-[14px] text-muted">No se pudieron cargar. Probá de nuevo en un rato.</p>;
  if (!stats) return <p className="py-4 text-center text-[14px] text-muted">Buscando los hashtags de @{handle}…</p>;
  if (stats.tags.length === 0)
    return (
      <div className="py-3 text-center">
        <p className="text-[14px] text-muted">Todavía no usaste hashtags con @{handle}. Cuando los uses, acá vas a ver cuáles se repiten y cuáles rinden más.</p>
        <button type="button" className="btn-ghost btn-sm mt-3" onClick={goIdeas}>
          Ver ideas por rubro
        </button>
      </div>
    );

  const best = bestTags(stats, 8);
  const used = stats.tags.slice(0, 30);

  return (
    <div className="space-y-5">
      <div>
        <Heading hint="Según los resultados que cargaste en las piezas publicadas.">Los que mejor funcionan</Heading>
        {best.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {best.map((t) => {
              const on = hasTag(caption, t.tag);
              const up = t.lift! >= 0;
              return (
                <li key={t.tag}>
                  <button type="button" onClick={() => toggle(t.tag)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-sunken/50">
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full border",
                        on ? "border-inverse bg-inverse text-inverse-ink" : "border-line text-muted",
                      )}
                    >
                      {on ? <Check className="size-3.5" strokeWidth={3} /> : <Plus className="size-3.5" strokeWidth={2.5} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{t.tag}</span>
                      <span className="block text-[12px] text-muted">
                        {t.measured} piezas medidas · {formatRate(t.rate ?? 0)} de interacción
                      </span>
                    </span>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12.5px] font-semibold tabular-nums",
                        up ? "bg-st-approved/15 text-st-approved" : "bg-sunken text-muted",
                      )}
                    >
                      {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                      {formatLift(t.lift!)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl bg-sunken/60 px-3 py-2.5 text-[13px] text-muted">
            Todavía no hay datos suficientes. Cuando marques piezas como “Publicado” y les cargues los resultados, vas a ver acá
            cuáles rinden más (hace falta que un hashtag esté en al menos {MIN_MEASURED} piezas medidas).
          </p>
        )}
      </div>
      <div>
        <Heading hint="Tocá para sumarlo o sacarlo del texto.">Los que más usás con @{handle}</Heading>
        <div className="flex flex-wrap gap-1.5">
          {used.map((t) => (
            <TagChip
              key={t.tag}
              tag={t.tag}
              on={hasTag(caption, t.tag)}
              onClick={() => toggle(t.tag)}
              meta={<span className="text-[12px] tabular-nums opacity-70">×{t.uses}</span>}
            />
          ))}
        </div>
      </div>
      {stats.baseline !== null && (
        <p className="text-[12px] text-muted">
          El porcentaje compara la interacción (me gusta, comentarios, guardados y compartidos sobre el alcance) de las piezas con ese
          hashtag contra el promedio de @{handle}: {formatRate(stats.baseline)}.
        </p>
      )}
    </div>
  );
}

function IdeasTab({ clientId, handle, caption, toggle }: { clientId: string; handle: string; caption: string; toggle: (t: string) => void }) {
  const key = `grilla:hashtag-rubro:${clientId}`;
  const [group, setGroup] = useState(HASHTAG_IDEAS[0].id);
  useEffect(() => {
    const saved = readStore(key);
    if (saved && HASHTAG_IDEAS.some((g) => g.id === saved)) setGroup(saved);
  }, [key]);
  const current = HASHTAG_IDEAS.find((g) => g.id === group) ?? HASHTAG_IDEAS[0];
  const brand = toHashtag(handle);

  return (
    <div className="space-y-4">
      {brand && (
        <div>
          <Heading hint="Conviene usarlo siempre: junta todo lo de la marca.">De la marca</Heading>
          <TagChip tag={brand} on={hasTag(caption, brand)} onClick={() => toggle(brand)} />
        </div>
      )}
      <div>
        <Heading>Por rubro</Heading>
        <div className="no-scrollbar -mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 pb-1">
          {HASHTAG_IDEAS.map((g) => (
            <button
              key={g.id}
              type="button"
              className="chip shrink-0"
              data-on={g.id === current.id}
              onClick={() => {
                setGroup(g.id);
                writeStore(key, g.id);
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {current.tags.map((t) => (
            <TagChip key={t} tag={t} on={hasTag(caption, t)} onClick={() => toggle(t)} />
          ))}
        </div>
        {current.id === "generales" && (
          <p className="mt-2 text-[12.5px] text-muted">Tienen muchísima competencia: sumá uno como mucho y acompañalo con hashtags del rubro.</p>
        )}
      </div>
      <p className="rounded-xl bg-accent-soft px-3 py-2.5 text-[13px] text-ink">
        <b>Tip:</b> Instagram recomienda pocos hashtags (de 3 a 5) y que tengan que ver con lo que muestra la pieza. Mezclá uno general,
        dos o tres del rubro o la zona, y el de la marca.
      </p>
    </div>
  );
}

function SearchTab({ caption, toggle, addAll }: { caption: string; toggle: (t: string) => void; addAll: (tags: string[]) => void }) {
  const [word, setWord] = useState("");
  const [pasted, setPasted] = useState("");
  const clean = toHashtag(word).slice(1);
  const sites = hashtagSites(word);
  const found = useMemo(() => {
    // Acepta la lista con o sin "#", separada por espacios, comas o renglones.
    const withHash = /#/.test(pasted) ? pasted : pasted.split(/[\s,;]+/).map((w) => (w ? toHashtag(w) : "")).join(" ");
    return extractHashtags(withHash);
  }, [pasted]);
  const missing = found.filter((t) => !hasTag(caption, t));

  return (
    <div className="space-y-5">
      <div>
        <Heading hint="Estas páginas miden en vivo qué hashtags se usan más. Escribí una palabra y abrí la que quieras.">
          Buscar lo que está usando la gente
        </Heading>
        <input
          className="field"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Ej. café, pilates, uñas, deco…"
          aria-label="Palabra para buscar hashtags"
        />
        <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
          {sites.map((s) => {
            const needsWord = !s.name.startsWith("TikTok");
            const disabled = needsWord && !clean;
            return (
              <li key={s.name}>
                <a
                  href={disabled ? undefined : s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={disabled}
                  className={cn(
                    "flex h-full items-start gap-2.5 rounded-xl border border-line px-3 py-2.5 transition-colors",
                    disabled ? "pointer-events-none opacity-45" : "hover:border-ink",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold">
                      {s.name}
                      {needsWord && clean && <span className="font-normal text-muted"> · #{clean}</span>}
                    </span>
                    <span className="block text-[12.5px] text-muted">{s.hint}</span>
                  </span>
                  <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted" />
                </a>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <Heading hint="Copiá los hashtags de esas páginas y pegalos acá: elegís cuáles sumar al texto.">Pegá los que copiaste</Heading>
        <textarea
          className="field min-h-[76px] resize-y text-[14px]"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="#cafe #coffee #cafedeespecialidad…"
          aria-label="Hashtags copiados"
        />
        {found.length > 0 && (
          <>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {found.map((t) => (
                <TagChip key={t} tag={t} on={hasTag(caption, t)} onClick={() => toggle(t)} />
              ))}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <button type="button" className="btn-primary btn-sm" disabled={!missing.length} onClick={() => addAll(missing)}>
                {missing.length ? `Sumar los ${missing.length}` : "Ya están todos en el texto"}
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setPasted("")}>
                Limpiar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
