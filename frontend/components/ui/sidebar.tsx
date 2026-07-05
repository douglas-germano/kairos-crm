"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { PanelLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
  state: "expanded" | "collapsed";
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = React.useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const [openMobile, setOpenMobile] = React.useState(false);
  const open = openProp ?? uncontrolledOpen;

  const setOpen = React.useCallback(
    (value: boolean) => {
      onOpenChange?.(value);
      setUncontrolledOpen(value);
    },
    [onOpenChange]
  );

  const toggleSidebar = React.useCallback(() => {
    setOpen(!open);
  }, [open, setOpen]);

  const contextValue = React.useMemo<SidebarContextValue>(
    () => ({
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      state: open ? "expanded" : "collapsed"
    }),
    [open, openMobile, setOpen, toggleSidebar]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-sidebar-wrapper=""
        data-state={open ? "expanded" : "collapsed"}
        style={
          {
            "--sidebar-width": "256px",
            "--sidebar-width-icon": "76px"
          } as React.CSSProperties
        }
        className={cn("group/sidebar-wrapper flex min-h-svh w-full bg-background text-foreground", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "icon",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
}) {
  const { state, openMobile, setOpenMobile } = useSidebar();

  return (
    <>
      <div
        data-sidebar="backdrop"
        data-open={openMobile}
        className={cn(
          "fixed inset-0 z-40 bg-brand-ink/32 opacity-0 transition-opacity duration-200 md:hidden",
          openMobile ? "pointer-events-auto opacity-100" : "pointer-events-none"
        )}
        onClick={() => setOpenMobile(false)}
      />
      <aside
        data-sidebar="sidebar"
        data-state={state}
        data-collapsible={state === "collapsed" ? collapsible : ""}
        data-variant={variant}
        data-side={side}
        className={cn(
          "fixed inset-y-0 z-50 flex h-svh w-[var(--sidebar-width)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[left,right,width] duration-base ease-brand md:left-0",
          side === "left" ? "left-0" : "right-0 border-l border-r-0",
          !openMobile && side === "left" ? "-left-[var(--sidebar-width)] md:left-0" : null,
          !openMobile && side === "right" ? "-right-[var(--sidebar-width)] md:right-0" : null,
          state === "collapsed" && collapsible === "icon" ? "md:w-[var(--sidebar-width-icon)]" : null,
          variant === "floating" ? "p-2" : null,
          className
        )}
        {...props}
      >
        <div
          data-sidebar="inner"
          className={cn(
            "flex h-full w-full flex-col bg-sidebar",
            variant === "floating" ? "rounded-panel border border-sidebar-border" : null
          )}
        >
          {children}
        </div>
      </aside>
    </>
  );
}

export function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  const { state } = useSidebar();

  return (
    <main
      data-sidebar="inset"
      data-state={state}
      className={cn(
        "min-h-svh flex-1 bg-background transition-[padding-left] duration-base ease-brand md:pl-[var(--sidebar-width)]",
        state === "collapsed" ? "md:pl-[var(--sidebar-width-icon)]" : null,
        className
      )}
      {...props}
    />
  );
}

export function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar, setOpenMobile } = useSidebar();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-9 w-9 border-brand-line bg-white text-brand-muted md:bg-white", className)}
      onClick={(event) => {
        if (window.matchMedia("(max-width: 767px)").matches) {
          setOpenMobile(true);
        } else {
          toggleSidebar();
        }
        onClick?.(event);
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Alternar sidebar</span>
    </Button>
  );
}

export function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      aria-label="Alternar sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      className={cn("absolute inset-y-0 -right-3 hidden w-6 cursor-ew-resize md:block", className)}
      {...props}
    />
  );
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="header" className={cn("flex flex-col gap-2 border-b border-sidebar-border p-3", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="footer" className={cn("mt-auto flex flex-col gap-2 border-t border-sidebar-border p-3", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="content" className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="group" className={cn("relative flex w-full min-w-0 flex-col", className)} {...props} />;
}

export function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-sidebar="group-label"
      className={cn("px-2 pb-2 text-[11px] font-extrabold uppercase tracking-[0.04em] text-sidebar-foreground/56", className)}
      {...props}
    />
  );
}

export function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="group-content" className={cn("w-full text-sm", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-sidebar="menu" className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-sidebar="menu-item" className={cn("group/menu-item relative", className)} {...props} />;
}

export function SidebarMenuButton({
  asChild = false,
  isActive = false,
  className,
  tooltip,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string;
}) {
  const Comp = asChild ? Slot : "button";
  const { state } = useSidebar();

  return (
    <Comp
      data-sidebar="menu-button"
      data-active={isActive}
      title={state === "collapsed" ? tooltip : undefined}
      className={cn(
        "focus-ring flex h-11 w-full items-center gap-3 overflow-hidden rounded-card px-3 text-left text-sm font-bold outline-none transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/72 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
        "group-data-[state=collapsed]/sidebar-wrapper:justify-center group-data-[state=collapsed]/sidebar-wrapper:px-0",
        "[&_svg]:size-[18px] [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  );
}
