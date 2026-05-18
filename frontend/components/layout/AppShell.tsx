"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, ChevronsLeft, ChevronsRight, CircleUserRound, MessagesSquare, Settings, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/conversations", label: "Conversas", icon: MessagesSquare },
  { href: "/contacts", label: "Contatos", icon: Users },
  { href: "/agents", label: "Agentes", icon: Sparkles },
  { href: "/settings", label: "Config.", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("kairos_sidebar_collapsed");
    if (stored) setCollapsed(stored === "true");
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("kairos_sidebar_collapsed", String(next));
      return next;
    });
  }

  return (
    <div className="app-canvas text-brand-charcoal">
      {/* ── Sidebar desktop ──────────────────────────────────────────── */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden border-r border-brand-line bg-white/95 shadow-sidebar backdrop-blur transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:flex lg:flex-col", collapsed ? "w-[76px]" : "w-[256px]")}>
        <button
          type="button"
          onClick={toggleSidebar}
          className="focus-ring absolute -right-3 top-8 z-40 flex h-7 w-7 items-center justify-center rounded-full border border-brand-line bg-white text-brand-muted shadow-[0_10px_28px_rgba(15,23,42,0.14)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-charcoal/20 hover:text-brand-ink"
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
        </button>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b border-brand-line px-4">
            <Link href="/conversations" className="relative flex h-10 w-full items-center justify-center overflow-hidden">
              <span
                className={cn(
                  "absolute left-1/2 top-1/2 font-display text-3xl font-black leading-none text-brand-red transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  collapsed
                    ? "-translate-x-1/2 -translate-y-1/2 opacity-100"
                    : "-translate-x-[74px] -translate-y-1/2 opacity-0"
                )}
                aria-hidden={!collapsed}
              >
                K
              </span>
              <span
                className={cn(
                  "absolute left-1/2 top-1/2 overflow-hidden font-display text-[22px] font-black leading-none text-brand-ink transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  collapsed
                    ? "-translate-x-[40px] -translate-y-1/2 opacity-0"
                    : "-translate-x-1/2 -translate-y-1/2 opacity-100"
                )}
                aria-hidden={collapsed}
              >
                Kairos
              </span>
            </Link>
          </div>

          <nav className={cn("flex-1 py-4 transition-[padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]", collapsed ? "px-2" : "px-3")}>
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "relative mb-1 flex h-11 items-center overflow-hidden rounded-card border-l-4 text-sm font-extrabold transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    collapsed ? "justify-center px-0" : "gap-3 px-3",
                    active ? "border-brand-red bg-brand-red50 text-brand-red" : "border-transparent text-brand-muted hover:bg-brand-canvas hover:text-brand-ink"
                  )}
                >
                  <Icon className="shrink-0" size={18} />
                  <span className={cn(
                    "overflow-hidden whitespace-nowrap transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    collapsed ? "w-0 translate-x-2 opacity-0" : "w-32 translate-x-0 opacity-100"
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className={cn("border-t border-brand-line p-3 transition-[padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]", collapsed && "px-2")}>
            <Link
              href="/settings"
              title={collapsed ? "Perfil e configurações" : undefined}
              className={cn(
                "focus-ring flex min-h-12 w-full items-center overflow-hidden rounded-card border-l-4 text-sm font-extrabold transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                pathname.startsWith("/settings") ? "border-brand-red bg-brand-red50 text-brand-red" : "border-transparent text-brand-muted hover:bg-brand-canvas hover:text-brand-ink",
                collapsed ? "justify-center px-0" : "gap-2.5 px-2"
              )}
            >
              <span className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1",
                pathname.startsWith("/settings") ? "bg-brand-red100 text-brand-red ring-brand-red200" : "bg-brand-canvas text-brand-ink ring-brand-line"
              )}>
                {user?.name?.[0]?.toUpperCase() || <CircleUserRound size={17} />}
              </span>
              <span className={cn(
                "min-w-0 flex-1 overflow-hidden text-left transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                collapsed ? "w-0 translate-x-2 opacity-0" : "w-[120px] translate-x-0 opacity-100"
              )}>
                <span className="block truncate text-xs font-extrabold">{user?.name || "Operador"}</span>
                <span className={cn("block truncate text-[11px] font-medium", pathname.startsWith("/settings") ? "text-brand-red/70" : "text-brand-muted")}>
                  Perfil e ajustes
                </span>
              </span>
              <ChevronRight size={13} className={cn("shrink-0 transition-all duration-500", collapsed ? "w-0 opacity-0" : "opacity-60")} />
            </Link>
          </div>
        </div>
      </aside>

      {/* ── Conteúdo principal ───────────────────────────────────────── */}
      <div className={cn(
        "h-screen overflow-hidden transition-[padding-left] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        collapsed ? "lg:pl-[76px]" : "lg:pl-[256px]"
      )}>
        <main className="h-full overflow-y-auto pb-[64px] lg:pb-0">{children}</main>
      </div>

      {/* ── Bottom nav mobile ────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-stretch border-t border-brand-line bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-wide transition-colors duration-200",
                active ? "text-brand-red" : "text-brand-muted"
              )}
            >
              <span className={cn(
                "flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200",
                active ? "bg-brand-red50" : ""
              )}>
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-16 items-center border-b border-brand-line bg-white/80 px-4 backdrop-blur sm:px-7">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-black leading-none text-brand-ink">{title}</h1>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
