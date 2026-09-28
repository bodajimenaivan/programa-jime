"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { PersonAvatar } from "@/components/ui/avatar";
import { Sheet } from "@/components/ui/sheet";
import { logout } from "@/app/(auth)/actions";

export function UserMenu({ user, workspaceName }: { user: { name: string; email: string; color: string }; workspaceName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-full" aria-label="Tu cuenta">
        <PersonAvatar name={user.name} color={user.color} size={30} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Tu cuenta">
        <div className="flex items-center gap-3 rounded-2xl bg-sunken/60 p-3">
          <PersonAvatar name={user.name} color={user.color} size={44} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-[13px] text-muted">{user.email}</p>
            <p className="truncate text-[13px] text-muted">{workspaceName}</p>
          </div>
        </div>
        <form action={logout} className="mt-4">
          <button className="btn-ghost w-full">
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </form>
      </Sheet>
    </>
  );
}
