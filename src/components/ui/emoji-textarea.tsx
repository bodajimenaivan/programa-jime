"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock3,
  Dog,
  Flag,
  Hand,
  Lightbulb,
  Plane,
  Search,
  Shapes,
  Smile,
  SmilePlus,
  Trophy,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** [emoji, palabras para buscar, variantes de tono de piel (claro → oscuro)] */
type Row = [string, string, string[]?];

const CATEGORIES = [
  { label: "Caras", icon: Smile },
  { label: "Personas y gestos", icon: Hand },
  { label: "Animales y naturaleza", icon: Dog },
  { label: "Comida y bebida", icon: UtensilsCrossed },
  { label: "Viajes y lugares", icon: Plane },
  { label: "Actividades", icon: Trophy },
  { label: "Objetos", icon: Lightbulb },
  { label: "Símbolos", icon: Shapes },
  { label: "Banderas", icon: Flag },
];

const TONES = ["", "🏻", "🏼", "🏽", "🏾", "🏿"];
const RECENT_KEY = "grilla:emojis-recientes";
const TONE_KEY = "grilla:emoji-tono";

let cache: Promise<Row[][]> | null = null;
const loadEmojis = () => (cache ??= import("@/lib/emoji-data.json").then((m) => m.default as unknown as Row[][]));

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();

/**
 * Textarea con selector de emojis tipo WhatsApp: el emoji se inserta donde estaba el cursor.
 * En el celu no vuelve a abrir el teclado al elegir, así podés sumar varios seguidos.
 */
export function EmojiTextarea({
  value,
  onChange,
  maxLength,
  className,
  placeholder,
  footer,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  className?: string;
  placeholder?: string;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const sel = useRef<[number, number]>([value.length, value.length]);
  const [open, setOpen] = useState(false);

  const remember = () => {
    const el = ref.current;
    if (el) sel.current = [el.selectionStart, el.selectionEnd];
  };

  const insert = (emoji: string) => {
    const [a, b] = sel.current.map((n) => Math.min(n, value.length));
    const next = value.slice(0, a) + emoji + value.slice(b);
    if (maxLength && next.length > maxLength) return false;
    onChange(next);
    const pos = a + emoji.length;
    sel.current = [pos, pos];
    // En compu devolvemos el foco al texto; en pantallas táctiles no, para que no salte el teclado.
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      requestAnimationFrame(() => {
        ref.current?.focus();
        ref.current?.setSelectionRange(pos, pos);
      });
    }
    return true;
  };

  return (
    <div>
      <textarea
        ref={ref}
        className={className}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          sel.current = [e.target.selectionStart, e.target.selectionEnd];
        }}
        onSelect={remember}
        onKeyUp={remember}
        onClick={remember}
        onFocus={() => {
          // Si el panel está abierto en el celu, al tocar el texto vuelve el teclado (como en WhatsApp).
          if (open && !window.matchMedia("(hover: hover) and (pointer: fine)").matches) setOpen(false);
        }}
      />
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            remember();
            setOpen((o) => !o);
          }}
          aria-expanded={open}
          aria-label={open ? "Cerrar emojis" : "Agregar emojis"}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors",
            open ? "border-inverse bg-inverse text-inverse-ink" : "border-line bg-surface text-ink hover:border-ink",
          )}
        >
          {open ? <X className="size-4" /> : <SmilePlus className="size-4" />}
          Emojis
        </button>
        {footer}
      </div>
      {open && <EmojiPanel onPick={insert} />}
    </div>
  );
}

function EmojiPanel({ onPick }: { onPick: (emoji: string) => boolean }) {
  const [groups, setGroups] = useState<Row[][] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [tone, setTone] = useState(0);
  const [toneOpen, setToneOpen] = useState(false);
  const [section, setSection] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const heads = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    setRecent(readStore<string[]>(RECENT_KEY, []));
    setTone(readStore<number>(TONE_KEY, 0));
    loadEmojis().then(setGroups, () => setFailed(true));
  }, []);

  const withTone = (row: Row) => (tone > 0 && row[2] ? row[2][tone - 1] : row[0]);

  const pick = (emoji: string) => {
    if (!onPick(emoji)) return;
    const next = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, 32);
    setRecent(next);
    writeStore(RECENT_KEY, next);
  };

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q || !groups) return null;
    const words = q.split(/\s+/);
    return groups.flat().filter((r) => words.every((w) => r[1].includes(w))).slice(0, 160);
  }, [query, groups]);

  // Resalta la categoría visible mientras se scrollea.
  const onScroll = () => {
    const top = scroller.current?.scrollTop ?? 0;
    let current = 0;
    heads.current.forEach((h, i) => {
      if (h && h.offsetTop - 8 <= top) current = i;
    });
    setSection(current);
  };

  const jump = (i: number) => {
    setQuery("");
    requestAnimationFrame(() => {
      const h = heads.current[i];
      if (h && scroller.current) scroller.current.scrollTo({ top: h.offsetTop - 4 });
      setSection(i);
    });
  };

  // Índice 0 = recientes; 1..9 = categorías.
  const tabs = [{ label: "Recientes", icon: Clock3 }, ...CATEGORIES];

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_12px_32px_-18px_rgb(0_0_0/0.35)]">
      <div className="flex items-center gap-2 border-b border-line p-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar: corazón, fuego, café…"
            aria-label="Buscar emoji"
            className="h-9 w-full rounded-full bg-sunken pr-3 pl-9 text-[14px] outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
          />
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setToneOpen((o) => !o)}
            className="grid size-9 place-items-center rounded-full text-[20px] hover:bg-sunken"
            aria-label="Tono de piel"
            aria-expanded={toneOpen}
          >
            {"👋" + TONES[tone]}
          </button>
          {toneOpen && (
            <div className="absolute top-full right-0 z-10 mt-1 flex gap-0.5 rounded-full border border-line bg-surface p-1 shadow-lg">
              {TONES.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setTone(i);
                    writeStore(TONE_KEY, i);
                    setToneOpen(false);
                  }}
                  className={cn("grid size-9 place-items-center rounded-full text-[20px]", tone === i ? "bg-accent-soft" : "hover:bg-sunken")}
                  aria-label={i === 0 ? "Tono amarillo" : `Tono ${i}`}
                >
                  {"👋" + t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={scroller} onScroll={onScroll} className="relative h-[260px] overflow-y-auto overscroll-contain px-1.5 pb-2 sm:h-[300px]">
        {failed ? (
          <p className="p-6 text-center text-[14px] text-muted">No se pudieron cargar los emojis. Probá de nuevo en un rato.</p>
        ) : !groups ? (
          <p className="p-6 text-center text-[14px] text-muted">Cargando emojis…</p>
        ) : results ? (
          results.length ? (
            <Grid rows={results.map(withTone)} onPick={pick} />
          ) : (
            <p className="p-6 text-center text-[14px] text-muted">No encontramos “{query}”. Probá con otra palabra.</p>
          )
        ) : (
          <>
            <Head ref={(el) => void (heads.current[0] = el)}>Recientes</Head>
            {recent.length ? (
              <Grid rows={recent} onPick={pick} />
            ) : (
              <p className="px-2 pb-2 text-[13px] text-muted">Los que uses van a aparecer acá.</p>
            )}
            {groups.map((rows, i) => (
              <div key={i}>
                <Head ref={(el) => void (heads.current[i + 1] = el)}>{CATEGORIES[i].label}</Head>
                <Grid rows={rows.map(withTone)} onPick={pick} />
              </div>
            ))}
          </>
        )}
      </div>

      <div className="no-scrollbar flex justify-between gap-0.5 overflow-x-auto border-t border-line px-1.5 py-1">
        {tabs.map(({ label, icon: Icon }, i) => (
          <button
            key={label}
            type="button"
            onClick={() => jump(i)}
            aria-label={label}
            title={label}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl transition-colors",
              !results && section === i ? "bg-accent-soft text-accent-strong" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="size-[18px]" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Head({ children, ref }: { children: React.ReactNode; ref: React.Ref<HTMLParagraphElement> }) {
  return (
    <p ref={ref} className="px-2 pt-2.5 pb-1 text-[12px] font-semibold text-muted">
      {children}
    </p>
  );
}

function Grid({ rows, onPick }: { rows: string[]; onPick: (e: string) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))]">
      {rows.map((e, i) => (
        <button
          key={e + i}
          type="button"
          onClick={() => onPick(e)}
          className="grid aspect-square place-items-center rounded-xl text-[26px] leading-none transition-transform hover:bg-sunken active:scale-90"
        >
          {e}
        </button>
      ))}
    </div>
  );
}
