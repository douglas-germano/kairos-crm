"use client";

import { Switch } from "./switch";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
};

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label
      className="focus-ring inline-flex items-center gap-2 rounded-[32px] text-sm font-extrabold text-brand-ink"
    >
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label ?? "Alternar"} />
      {label ? <span>{label}</span> : null}
    </label>
  );
}
