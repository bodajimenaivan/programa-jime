"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChartNoAxesColumn, LogOut, Plus, SquareKanban, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { PersonAvatar } from "@/components/ui/avatar";
import { ClientSwitcher } from "./client-switcher";
import { UserMenu } from "./user-menu";
import { ShellContext, type ShellClient } from "./shell-context";
import { logout } from "@/app/(auth)/actions";

const NAV = [
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/tareas", label: "Tareas", icon: SquareKanban },
  { href: "/metricas", label: "Métricas", icon: ChartNoAxesColumn },
  { href: "/clientes", label: "Clientes", icon: Users },
];

export function AppShell({
  user,
  workspaceName,
  clients,
  activeId,
  children,
}: {
  user: { name: string; email: string; color: string };
  workspaceName: string;
  clients: ShellClient[];
  activeId: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = clients.find((c) => c.id === activeId) ?? null;
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  // El editor de piezas ocupa toda la pantalla en mobile.
  const immersive = pathname.startsWith("/posts/");

  return (
    <ShellContext.Provider value={{ clients, active }}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr] print:block">
        {/* Sidebar desktop */}
        <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line px-4 py-5 lg:flex">
          <Link href="/calendario" className="px-2">
            <Logo />
          </Link>
          <div className="mt-6">
            <ClientSwitcher variant="sidebar" />
          </div>
          <Link href="/posts/nuevo" className="btn-accent mt-4 w-full">
            <Plus className="size-[18px]" strokeWidth={2.5} /> Nueva pieza
          </Link>
          <nav className="mt-6 space-y-0.5">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                  isActive(href) ? "bg-surface text-ink shadow-[0_0_0_1px_var(--c-line)]" : "text-ink-2 hover:bg-sunken/60",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={isActive(href) ? 2.4 : 2} />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex items-center gap-3 rounded-2xl px-2 py-2">
            <PersonAvatar name={user.name} color={user.color} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{user.name}</p>
              <p className="truncate text-[12px] text-muted">{workspaceName}</p>
            </div>
            <form action={logout}>
              <button className="grid size-9 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label="Salir">
                <LogOut className="size-[17px]" />
              </button>
            </form>
          </div>
        </aside>

        {/* Contenido */}
        <div className={cn("min-w-0", !immersive && "pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0")}>
          {!immersive && (
            <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line/70 bg-bg/85 px-3.5 backdrop-blur-md lg:hidden">
              <ClientSwitcher variant="topbar" />
              <UserMenu user={user} workspaceName={workspaceName} />
            </header>
          )}
          {children}
        </div>

        {/* Barra inferior mobile */}
        {!immersive && (
          <nav
            className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="mx-auto grid h-[64px] max-w-md grid-cols-5 items-center">
              {NAV.slice(0, 2).map((item) => (
                <TabLink key={item.href} {...item} on={isActive(item.href)} />
              ))}
              <div className="flex justify-center">
                <Link
                  href="/posts/nuevo"
                  aria-label="Nueva pieza"
                  className="grid size-12 place-items-center rounded-[18px] bg-accent text-accent-ink shadow-[0_6px_16px_-6px_var(--c-accent)] transition-transform active:scale-95"
                >
                  <Plus className="size-6" strokeWidth={2.5} />
                </Link>
              </div>
              {NAV.slice(2).map((item) => (
                <TabLink key={item.href} {...item} on={isActive(item.href)} />
              ))}
            </div>
          </nav>
        )}
      </div>
    </ShellContext.Provider>
  );
}

function TabLink({ href, label, icon: Icon, on }: (typeof NAV)[number] & { on: boolean }) {
  return (
    <Link href={href} className={cn("flex flex-col items-center gap-1 pt-1 text-[11px] font-medium", on ? "text-ink" : "text-muted")}>
      <Icon className="size-[22px]" strokeWidth={on ? 2.4 : 1.9} />
      {label}
    </Link>
  );
}
