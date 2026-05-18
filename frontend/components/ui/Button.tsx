"use client";

import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "red" | "ghost" | "pill" | "dark" | "subtle";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ className, variant = "red", ...props }: ButtonProps) {
  const variants: Record<Variant, string> = {
    red: "rounded-card border border-brand-red bg-brand-red px-3.5 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-redDark active:translate-y-px",
    ghost: "rounded-card border border-brand-line bg-white px-3.5 py-2.5 text-sm font-extrabold text-brand-ink shadow-sm transition hover:border-brand-charcoal/25 hover:bg-brand-canvas active:translate-y-px",
    pill: "rounded-[60px] bg-brand-red px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-redDark active:translate-y-px",
    dark: "rounded-card border border-brand-charcoal bg-brand-charcoal px-3.5 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-ink active:translate-y-px",
    subtle: "rounded-[60px] bg-red-50 px-4 py-2 text-sm font-extrabold text-brand-red transition hover:bg-red-100 active:translate-y-px"
  };

  return <button className={cn("focus-ring inline-flex min-h-10 items-center justify-center gap-2 disabled:translate-y-0", variants[variant], className)} {...props} />;
}
