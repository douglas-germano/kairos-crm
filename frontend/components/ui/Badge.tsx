import { cn } from "@/lib/utils";

type BadgeProps = {
  children: React.ReactNode;
  tone?: "red" | "neutral" | "dark" | "green";
  className?: string;
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  const tones = {
    red: "border-red-200 bg-red-50 text-brand-red",
    neutral: "border-brand-line bg-white text-brand-muted",
    dark: "border-transparent bg-brand-charcoal text-white",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700"
  };

  return (
    <span className={cn("inline-flex items-center rounded-[32px] border px-2.5 py-1 text-[11px] font-extrabold uppercase", tones[tone], className)}>
      {children}
    </span>
  );
}
