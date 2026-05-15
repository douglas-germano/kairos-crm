"use client";

import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "red" | "ghost" | "pill" | "dark" | "subtle";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ className, variant = "red", ...props }: ButtonProps) {
  const variants: Record<Variant, string> = {
    red: "rounded-tight border border-brand-red bg-brand-red px-3 py-2 text-sm font-bold text-white active:opacity-90",
    ghost: "rounded-tight border border-brand-charcoal bg-white px-3 py-2 text-sm font-bold text-brand-charcoal active:opacity-90",
    pill: "rounded-[60px] bg-brand-red px-4 py-3 text-sm font-bold text-white active:opacity-90",
    dark: "rounded-tight border border-brand-charcoal bg-brand-charcoal px-3 py-2 text-sm font-bold text-white active:opacity-90",
    subtle: "rounded-[60px] bg-black/5 px-4 py-2 text-sm font-bold text-brand-red active:opacity-90"
  };

  return <button className={cn("focus-ring inline-flex items-center justify-center gap-2", variants[variant], className)} {...props} />;
}
