import { cn } from "@/lib/utils";

const SIZES = {
  xs: "h-5 w-5",
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-12 w-12",
  xl: "h-14 w-14"
} as const;

const TONES = {
  canvas: "bg-brand-canvas text-brand-ink",
  charcoal: "bg-brand-charcoal text-white",
  accent: "bg-brand-red50 text-brand-red",
  success: "bg-brand-successSoft text-brand-successStrong",
  // círculo branco sobre um card já colorido (ex: card de status verde)
  successGlass: "bg-white text-brand-successStrong shadow-xs",
  whatsapp: "bg-[#25D366] text-white",
  // gradiente real da marca Instagram — exceção documentada, não é gradiente decorativo nosso
  instagram: "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white"
} as const;

type Props = {
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  shrink?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function IconBadge({ size = "md", tone = "canvas", shrink, className, children }: Props) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full",
        SIZES[size],
        TONES[tone],
        shrink && "shrink-0",
        className
      )}
    >
      {children}
    </span>
  );
}
