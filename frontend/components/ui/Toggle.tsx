"use client";

import { cn } from "@/lib/utils";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
};

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="focus-ring inline-flex items-center gap-2 rounded-[32px] text-sm font-bold text-brand-charcoal"
      aria-pressed={checked}
    >
      <span className={cn("relative h-6 w-11 rounded-[32px] transition", checked ? "bg-brand-red" : "bg-[#bebebe]")}>
        <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition", checked ? "left-6" : "left-1")} />
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}
