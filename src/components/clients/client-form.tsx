"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Check } from "lucide-react";
import { ClientAvatar } from "@/components/ui/avatar";
import { NetworkIcon } from "@/components/ui/network-icon";
import { NETWORK_LABEL, NETWORK_ORDER, SWATCHES } from "@/lib/constants";
import type { Network } from "@/lib/db/schema";
import { saveClient, type ClientFormState } from "@/app/(app)/actions/clients";
import { uploadMedia } from "@/lib/uploader";
import { cn } from "@/lib/utils";
import { useShell } from "@/components/shell/shell-context";

type Initial = { id: string; name: string; handle: string; color: string; avatarId: string | null; networks: Network[] };

export function ClientForm({ initial, onDone }: { initial?: Initial; onDone?: () => void }) {
  const [state, action, pending] = useActionState<ClientFormState, FormData>(saveClient, undefined);
  const [name, setName] = useState(initial?.name ?? "");
  const { clients } = useShell();
  const [color, setColor] = useState(initial?.color ?? SWATCHES[clients.length % SWATCHES.length]);
  const [avatarId, setAvatarId] = useState<string | null>(initial?.avatarId ?? null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [networks, setNetworks] = useState<Network[]>(initial?.networks ?? ["instagram"]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);

  const onFile = async (file?: File) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const { handle } = await uploadMedia(file);
      setAvatarId(await handle.promise);
    } catch {
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form action={action} className="space-y-5">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="color" value={color} />
      <input type="hidden" name="avatarId" value={avatarId ?? ""} />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative shrink-0 rounded-full"
          aria-label="Subir foto de perfil"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className={cn("size-[72px] rounded-full object-cover", uploading && "opacity-60")} />
          ) : (
            <ClientAvatar client={{ name: name || "?", color, avatarId }} size={72} />
          )}
          <span className="absolute -bottom-0.5 -right-0.5 grid size-7 place-items-center rounded-full border-2 border-surface bg-inverse text-inverse-ink">
            <Camera className="size-3.5" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className="grid size-7 place-items-center rounded-full"
              style={{ background: c }}
              aria-label={`Color ${c}`}
            >
              {c === color && <Check className="size-3.5 text-white" strokeWidth={3.5} />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="c-name">Nombre de la marca</label>
        <input
          id="c-name"
          name="name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Café Tostado"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="c-handle">Usuario</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">@</span>
          <input id="c-handle" name="handle" className="field pl-8" defaultValue={initial?.handle} placeholder="cafetostado" />
        </div>
      </div>
      <fieldset>
        <legend className="label">Redes que manejás</legend>
        <div className="flex flex-wrap gap-2">
          {NETWORK_ORDER.map((n) => {
            const on = networks.includes(n);
            return (
              <label key={n} className="chip cursor-pointer" data-on={on}>
                <input
                  type="checkbox"
                  name="networks"
                  value={n}
                  checked={on}
                  onChange={() => setNetworks((prev) => (on ? prev.filter((x) => x !== n) : [...prev, n]))}
                  className="sr-only"
                />
                <NetworkIcon network={n} />
                {NETWORK_LABEL[n]}
              </label>
            );
          })}
        </div>
      </fieldset>

      {state?.error && <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[14px]">{state.error}</p>}

      <button className="btn-primary w-full" disabled={pending || uploading}>
        {uploading ? "Subiendo foto…" : pending ? "Guardando…" : initial ? "Guardar cambios" : "Crear cliente"}
      </button>
    </form>
  );
}
