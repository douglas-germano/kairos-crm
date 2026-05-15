import { cn } from "@/lib/utils";

type BadgeProps = {
  children: React.ReactNode;
  tone?: "red" | "neutral" | "dark" | "green";
  className?: string;
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  const tones = {
    red: "border-brand-red bg-white/80 text-black/80",
    neutral: "border-transparent bg-brand-neutral text-brand-charcoal",
    dark: "border-transparent bg-brand-charcoal text-white",
    green: "border-transparent bg-emerald-50 text-emerald-800"
  };

  return (
    <span className={cn("inline-flex items-center rounded-[32px] border px-3 py-1 text-xs font-bold uppercase", tones[tone], className)}>
      {children}
    </span>
  );
}
