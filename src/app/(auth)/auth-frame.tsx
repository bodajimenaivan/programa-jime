import { Logo } from "@/components/ui/logo";

const TILES = [
  { bg: "#FF5B2E", label: "Reel", shape: "reel" },
  { bg: "#E9E4D6", label: "", shape: "img" },
  { bg: "#4A4437", label: "Carrusel", shape: "carousel" },
  { bg: "#DCE7FF", label: "", shape: "img" },
  { bg: "#1E9E63", label: "Aprobado", shape: "check" },
  { bg: "#F7D774", label: "", shape: "img" },
  { bg: "#E9E4D6", label: "", shape: "img" },
  { bg: "#FFE4DA", label: "Historia", shape: "story" },
  { bg: "#2F6BF2", label: "", shape: "img" },
] as const;

/** Marco visual de login y registro (compartido con la versión PHP). */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-inverse p-12 text-inverse-ink lg:flex lg:flex-col lg:justify-between">
        <Logo className="text-inverse-ink" />
        <div className="grid max-w-[420px] grid-cols-3 gap-2">
          {TILES.map((t, i) => (
            <div
              key={i}
              className="relative aspect-[4/5] overflow-hidden rounded-[10px]"
              style={{ background: t.bg, animation: `pop-in 400ms ${i * 50}ms both cubic-bezier(.2,.9,.25,1)` }}
            >
              {t.label && (
                <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#17140F]">
                  {t.label}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="max-w-md">
          <p className="font-display text-[34px] font-bold leading-[1.05] tracking-[-0.02em]">
            La grilla del mes, aprobada sin perseguir a nadie por WhatsApp.
          </p>
          <p className="mt-4 text-[15px] text-inverse-ink/60">
            Calendario por cliente, vistas previas reales de cada reel, historia y posteo, y un link para que el cliente apruebe desde el celu.
          </p>
        </div>
      </aside>

      <main className="flex flex-col px-5 pb-10 pt-6 sm:px-8 lg:justify-center lg:px-16">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto mt-10 w-full max-w-[400px] lg:mt-0">{children}</div>
      </main>
    </div>
  );
}
