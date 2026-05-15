"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, ChevronDown, LogOut, MessageSquareText, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/conversations", label: "Conversas", icon: MessageSquareText },
  { href: "/agents", label: "Agentes", icon: Bot },
  { href: "/settings", label: "Configuracoes", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, workspace, logout } = useAuth(true);
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
    <div className="min-h-screen bg-[#f6f7f8] text-brand-charcoal">
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden border-r border-black/10 bg-white transition-[width] duration-200 lg:block", collapsed ? "w-[76px]" : "w-[248px]")}>
        <div className="flex h-full flex-col">
          <div className={cn("flex h-24 items-center border-b border-black/10 px-4", collapsed ? "flex-col justify-center gap-4 py-4" : "justify-between")}>
            <Link href="/conversations" className={cn("flex min-w-0 items-center gap-3", collapsed && "justify-center")}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-tight bg-brand-red text-sm font-black text-white">K</span>
              {!collapsed ? (
                <div className="min-w-0">
                  <div className="truncate text-sm font-black leading-none">KairosCRM</div>
                  <div className="mt-1 truncate text-[11px] text-brand-grey">CRM de atendimento</div>
                </div>
              ) : null}
            </Link>
            <button
              type="button"
              onClick={toggleSidebar}
              className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-tight text-brand-grey hover:bg-brand-neutral hover:text-brand-charcoal"
              aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>

          <nav className={cn("flex-1 px-3 py-3", collapsed && "px-2")}>
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "mb-1 flex h-10 items-center rounded-tight text-sm font-semibold transition",
                    collapsed ? "justify-center px-0" : "gap-3 px-3",
                    active ? "bg-brand-red text-white" : "text-brand-charcoal hover:bg-brand-neutral"
                  )}
                >
                  <Icon size={18} />
                  {!collapsed ? item.label : null}
                </Link>
              );
            })}
          </nav>

          <div className={cn("border-t border-black/10 p-3", collapsed && "px-2")}>
            <div className={cn("mb-2 flex items-center px-2 py-1", collapsed ? "justify-center px-0" : "gap-2")}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-neutral text-xs font-black">
                {user?.name?.[0]?.toUpperCase() || "K"}
              </span>
              {!collapsed ? <div className="min-w-0">
                <div className="truncate text-xs font-bold">{user?.name || "Operador"}</div>
                <div className="truncate text-[11px] text-brand-grey">{user?.email || ""}</div>
              </div> : null}
            </div>
            <button
              onClick={logout}
              title={collapsed ? "Sair" : undefined}
              className={cn("focus-ring flex h-9 w-full items-center rounded-tight text-sm font-semibold text-brand-grey hover:bg-brand-neutral", collapsed ? "justify-center px-0" : "gap-2 px-2")}
            >
              <LogOut size={17} />
              {!collapsed ? "Sair" : null}
            </button>
          </div>
        </div>
      </aside>

      <div className={cn("transition-[padding-left] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[248px]")}>
        <main>{children}</main>
      </div>
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
    <div className="flex h-24 items-center border-b border-black/10 bg-white px-4 sm:px-7">
      <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="mb-0.5 text-[11px] font-bold uppercase text-brand-grey">
            {eyebrow}
          </div>
          <h1 className="display-title text-xl">{title}</h1>
          {description ? <p className="mt-0.5 max-w-2xl text-xs text-brand-grey">{description}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}
