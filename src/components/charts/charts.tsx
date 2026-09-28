"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/utils";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return step * exp;
}

export type Series = { key: string; label: string; color: string; values: (number | null)[] };

type Tip = { x: number; y: number; title: string; rows: { color?: string; label: string; value: string }[] } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-[140px] -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-pop"
      style={{ left: tip.x, top: tip.y - 10 }}
    >
      <p className="mb-1 font-semibold capitalize text-ink-2">{tip.title}</p>
      {tip.rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2">
          {r.color && <span className="h-0.5 w-3 rounded-full" style={{ background: r.color }} />}
          <span className="font-semibold tabular-nums text-ink">{r.value}</span>
          <span className="text-muted">{r.label}</span>
        </p>
      ))}
    </div>
  );
}

/** Líneas de tendencia: 2px, crosshair que se engancha al mes más cercano, etiqueta al final de cada línea. */
export function LineChart({ labels, series, height = 220 }: { labels: string[]; series: Series[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 16, right: 96, bottom: 28, left: 44 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const max = niceMax(Math.max(...all, 0) * 1.08);
  const x = (i: number) => pad.left + (labels.length > 1 ? (i / (labels.length - 1)) * w : w / 2);
  const y = (v: number) => pad.top + h - (v / max) * h;
  const ticks = [0, max / 2, max];

  // Etiquetas finales: si chocan, se separan con línea guía.
  const ends = series
    .map((s) => {
      const lastIdx = s.values.findLastIndex((v) => v !== null);
      return lastIdx < 0 ? null : { s, lastIdx, y: y(s.values[lastIdx]!) };
    })
    .filter((e): e is NonNullable<typeof e> => !!e)
    .sort((a, b) => a.y - b.y);
  const labelY: number[] = [];
  ends.forEach((e, i) => (labelY[i] = Math.max(e.y, i ? labelY[i - 1] + 16 : -Infinity)));

  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + w} y1={y(t)} y2={y(t)} stroke="var(--c-grid)" strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {formatNumber(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) => (
            <text key={l + i} x={x(i)} y={height - 8} textAnchor="middle" className="fill-muted text-[11px] capitalize">
              {l}
            </text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + h} stroke="var(--c-line-strong)" strokeWidth={1} />}
          {series.map((s) => {
            const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)] as const)).filter((p): p is readonly [number, number] => !!p);
            return (
              <g key={s.key}>
                <path
                  d={pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {pts.length > 0 && (
                  <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r={4} fill={s.color} stroke="var(--c-surface)" strokeWidth={2} />
                )}
                {hover !== null && s.values[hover] !== null && (
                  <circle cx={x(hover)} cy={y(s.values[hover]!)} r={4.5} fill={s.color} stroke="var(--c-surface)" strokeWidth={2} />
                )}
              </g>
            );
          })}
          {ends.map((e, i) => (
            <g key={e.s.key}>
              {Math.abs(labelY[i] - e.y) > 2 && (
                <line x1={x(e.lastIdx) + 6} x2={x(e.lastIdx) + 12} y1={e.y} y2={labelY[i]} stroke="var(--c-line-strong)" strokeWidth={1} />
              )}
              <text x={x(e.lastIdx) + 14} y={labelY[i]} dy="0.32em" className="fill-ink-2 text-[12px] font-semibold">
                {e.s.label} <tspan className="fill-muted font-normal">{formatNumber(e.s.values[e.lastIdx]!)}</tspan>
              </text>
            </g>
          ))}
          <rect
            x={pad.left - 10}
            y={pad.top}
            width={w + 20}
            height={h}
            fill="transparent"
            onPointerMove={(ev) => {
              const box = (ev.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect();
              const px = ev.clientX - box.left;
              const i = labels.length > 1 ? Math.round(((px - pad.left) / w) * (labels.length - 1)) : 0;
              setHover(Math.max(0, Math.min(labels.length - 1, i)));
            }}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      <Tooltip
        tip={
          hover === null
            ? null
            : {
                x: x(hover),
                y: Math.min(...series.map((s) => (s.values[hover] === null ? pad.top + h : y(s.values[hover]!)))),
                title: labels[hover],
                rows: series
                  .filter((s) => s.values[hover] !== null)
                  .map((s) => ({ color: s.color, label: s.label, value: s.values[hover]!.toLocaleString("es-AR") })),
              }
        }
      />
    </div>
  );
}

/** Columnas de una sola serie con énfasis: el mes elegido en acento, el resto en gris. */
export function ColumnChart({
  labels,
  values,
  highlight,
  label,
  height = 200,
}: {
  labels: string[];
  values: (number | null)[];
  highlight: number;
  label: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 22, right: 8, bottom: 28, left: 44 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...values.map((v) => v ?? 0), 0) * 1.1);
  const band = labels.length ? w / labels.length : 0;
  const barW = Math.min(24, band * 0.5);
  const y = (v: number) => pad.top + h - (v / max) * h;

  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height}>
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + w} y1={y(t)} y2={y(t)} stroke="var(--c-grid)" strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {formatNumber(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) => {
            const v = values[i];
            const cx = pad.left + band * i + band / 2;
            const top = v ? y(v) : pad.top + h;
            const hBar = pad.top + h - top;
            const r = Math.min(4, hBar);
            const on = i === highlight;
            return (
              <g key={l + i}>
                {v !== null && v > 0 && (
                  <path
                    d={`M${cx - barW / 2},${pad.top + h} V${top + r} Q${cx - barW / 2},${top} ${cx - barW / 2 + r},${top} H${cx + barW / 2 - r} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + r} V${pad.top + h} Z`}
                    fill={on ? "var(--c-accent)" : "var(--c-deemph)"}
                    opacity={hover !== null && hover !== i ? 0.7 : 1}
                  />
                )}
                {on && v !== null && (
                  <text x={cx} y={top - 7} textAnchor="middle" className="fill-ink text-[11.5px] font-semibold">
                    {formatNumber(v)}
                  </text>
                )}
                <text x={cx} y={height - 8} textAnchor="middle" className={on ? "fill-ink text-[11px] font-semibold capitalize" : "fill-muted text-[11px] capitalize"}>
                  {l}
                </text>
                <rect
                  x={cx - band / 2}
                  y={pad.top}
                  width={band}
                  height={h}
                  fill="transparent"
                  tabIndex={0}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
      )}
      <Tooltip
        tip={
          hover === null || values[hover] === null
            ? null
            : {
                x: pad.left + band * hover + band / 2,
                y: y(values[hover] ?? 0),
                title: labels[hover],
                rows: [{ label, value: (values[hover] ?? 0).toLocaleString("es-AR") }],
              }
        }
      />
    </div>
  );
}

/** Mini tendencia para las tarjetas: gris, con el último punto en acento. */
export function Sparkline({ values, width = 84, height = 28 }: { values: (number | null)[]; width?: number; height?: number }) {
  // Solo meses con datos; con menos de dos puntos no hay tendencia que mostrar.
  const pts0 = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts0.length < 2) return null;
  const nums = pts0.map((p) => p[1]);
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const span = max - min || 1;
  const n = Math.max(1, values.length - 1);
  const pts = pts0.map(([i, v]) => [(i / n) * (width - 6) + 3, height - 3 - ((v - min) / span) * (height - 6)]);
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("")} fill="none" stroke="var(--c-deemph)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r={3.5} fill="var(--c-accent)" stroke="var(--c-surface)" strokeWidth={1.5} />
    </svg>
  );
}
