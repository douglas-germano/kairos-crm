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
      className="focus-ring inline-flex items-center gap-2 rounded-pill text-[13px] font-extrabold text-brand-ink"
      aria-pressed={checked}
    >
      <span className={cn("relative h-6 w-11 rounded-pill shadow-inner transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]", checked ? "bg-brand-red" : "bg-brand-grey/45")}>
        <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]", checked ? "left-6" : "left-1")} />
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}
