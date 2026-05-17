import { cn } from "@/lib/utils";

type BadgeProps = {
  children: React.ReactNode;
  tone?: "red" | "neutral" | "dark" | "green";
  className?: string;
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  const tones = {
    red: "border-brand-red200 bg-brand-red50 text-brand-red",
    neutral: "border-brand-line bg-white text-brand-muted",
    dark: "border-transparent bg-brand-charcoal text-white",
    green: "border-brand-success/20 bg-brand-successSoft text-brand-successStrong"
  };

  return (
    <span className={cn("inline-flex items-center rounded-pill border px-2.5 py-1 font-condensed text-xs font-bold uppercase tracking-[0.04em]", tones[tone], className)}>
      {children}
    </span>
  );
}
