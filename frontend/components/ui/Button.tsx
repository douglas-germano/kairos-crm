"use client";

import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "red" | "ghost" | "pill" | "dark" | "subtle";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ className, variant = "red", ...props }: ButtonProps) {
  const variants: Record<Variant, string> = {
    red: "border-brand-red bg-brand-red text-white shadow-sm hover:bg-brand-redDark",
    ghost: "border-brand-line bg-white text-brand-ink shadow-sm hover:border-brand-charcoal/25 hover:bg-brand-canvas",
    pill: "border-brand-red bg-brand-red text-white shadow-sm hover:bg-brand-redDark",
    dark: "border-brand-charcoal bg-brand-charcoal text-white shadow-sm hover:bg-brand-ink",
    subtle: "border-brand-red200 bg-brand-red50 text-brand-red hover:bg-brand-red100"
  };

  return (
    <button
      className={cn(
        "k-button focus-ring inline-flex h-10 min-h-10 items-center justify-center gap-2 rounded-card px-4 text-sm font-extrabold transition duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:translate-y-px disabled:translate-y-0",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
