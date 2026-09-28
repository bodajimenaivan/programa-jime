"use client";

import { Check } from "lucide-react";
import { PersonAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type Person = { id: string; name: string; color: string; role?: string };

/** Elegir una persona (single) o varias (multiple) del equipo. */
export function PeoplePicker({
  people,
  value,
  onChange,
  multiple = false,
  emptyLabel = "Nadie",
}: {
  people: Person[];
  value: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  emptyLabel?: string;
}) {
  const toggle = (id: string) => {
    if (multiple) onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
    else onChange(value.includes(id) ? [] : [id]);
  };
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
      {!multiple && (
        <button type="button" className="chip" data-on={value.length === 0} onClick={() => onChange([])}>
          {emptyLabel}
        </button>
      )}
      {people.map((p) => {
        const on = value.includes(p.id);
        return (
          <button key={p.id} type="button" className="chip pl-1.5" data-on={on} onClick={() => toggle(p.id)} title={p.role || undefined}>
            <span className="relative">
              <PersonAvatar name={p.name} color={p.color} size={24} />
              {multiple && on && (
                <span className="absolute -bottom-1 -right-1 grid size-3.5 place-items-center rounded-full bg-accent text-accent-ink ring-2 ring-inverse">
                  <Check className="size-2.5" strokeWidth={3.5} />
                </span>
              )}
            </span>
            {p.name.split(" ")[0]}
          </button>
        );
      })}
    </div>
  );
}

/** Avatares apilados (para mostrar quiénes participan). */
export function AvatarStack({ people, size = 22, className }: { people: Person[]; size?: number; className?: string }) {
  if (people.length === 0) return null;
  return (
    <span className={cn("flex -space-x-1.5", className)} title={people.map((p) => p.name).join(", ")}>
      {people.slice(0, 4).map((p) => (
        <span key={p.id} className="rounded-full ring-2 ring-surface">
          <PersonAvatar name={p.name} color={p.color} size={size} />
        </span>
      ))}
      {people.length > 4 && (
        <span
          className="grid place-items-center rounded-full bg-sunken text-[10px] font-bold text-ink-2 ring-2 ring-surface"
          style={{ width: size, height: size }}
        >
          +{people.length - 4}
        </span>
      )}
    </span>
  );
}
