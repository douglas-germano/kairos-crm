"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bot,
  ChevronRight,
  CircleUserRound,
  Megaphone,
  MessagesSquare,
  Settings,
  UsersRound
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/conversations", label: "Conversas", icon: MessagesSquare },
  { href: "/contacts", label: "Contatos", icon: UsersRound },
  { href: "/broadcasts", label: "Campanhas", icon: Megaphone },
  { href: "/agents", label: "Agentes", icon: Bot },
  { href: "/settings", label: "Configurações", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem("kairos_sidebar_collapsed");
    if (stored) setOpen(stored !== "true");
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    window.localStorage.setItem("kairos_sidebar_collapsed", String(!nextOpen));
  }

  return (
    <SidebarProvider open={open} onOpenChange={handleOpenChange} className="app-canvas text-brand-charcoal">
      <Sidebar collapsible="icon" className="border-r border-brand-line bg-brand-white/90 backdrop-blur">
        <SidebarHeader className="h-16 justify-center px-3">
          <Link href="/conversations" className="focus-ring flex h-11 items-center gap-3 overflow-hidden rounded-card px-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand-red text-xl font-bold leading-none text-white">
              K
            </span>
            <span className="min-w-0 text-[22px] font-bold leading-none text-brand-ink transition-opacity group-data-[state=collapsed]/sidebar-wrapper:w-0 group-data-[state=collapsed]/sidebar-wrapper:opacity-0">
              Kairos
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link href={item.href}>
                          <Icon />
                          <span className="truncate transition-opacity group-data-[state=collapsed]/sidebar-wrapper:hidden">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith("/settings")} tooltip="Perfil e ajustes" className="h-12">
                <Link href="/settings">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1",
                      pathname.startsWith("/settings")
                        ? "bg-brand-red100 text-brand-red ring-brand-red200"
                        : "bg-brand-canvas text-brand-ink ring-brand-line"
                    )}
                  >
                    {user?.name?.[0]?.toUpperCase() || <CircleUserRound size={17} />}
                  </span>
                  <span className="min-w-0 flex-1 overflow-hidden text-left group-data-[state=collapsed]/sidebar-wrapper:hidden">
                    <span className="block truncate text-xs font-extrabold">{user?.name || "Operador"}</span>
                    <span className="block truncate text-[11px] font-medium text-brand-muted">Perfil e ajustes</span>
                  </span>
                  <ChevronRight className="opacity-60 group-data-[state=collapsed]/sidebar-wrapper:hidden" size={13} />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="h-screen overflow-hidden">
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center gap-3 border-b border-brand-line bg-brand-white/80 px-4 backdrop-blur md:hidden">
            <SidebarTrigger />
            <span className="text-xl font-bold text-brand-ink">Kairos</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
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
    <div className="flex h-16 items-center border-b border-brand-line bg-brand-white/80 px-4 backdrop-blur sm:px-7">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="ui-label hidden sm:block">{eyebrow}</p>
          <h1 className="truncate text-lg font-black leading-none text-brand-ink">{title}</h1>
          {description ? <p className="body-muted mt-1 hidden sm:block">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
