import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-0.5 text-[11px] font-semibold leading-5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Pill preenchida — tags discretas, look padrão de badge.
        default: "rounded-pill border-transparent bg-primary text-primary-foreground",
        secondary: "rounded-pill border-transparent bg-secondary text-secondary-foreground",
        destructive: "rounded-pill border-transparent bg-brand-dangerSoft text-brand-danger",
        neutral: "rounded-pill border-brand-line bg-brand-canvas text-brand-muted",
        dark: "rounded-pill border-transparent bg-brand-charcoal text-white",
        green: "rounded-pill border-transparent bg-brand-successSoft text-brand-successStrong",
        outline: "rounded-pill border-brand-line bg-brand-white text-brand-muted",
        // Tag do accent — contorno violeta discreto sobre fundo suave.
        red: "rounded-pill border-brand-red200 bg-brand-red50 text-brand-red"
      }
    },
    defaultVariants: {
      variant: "neutral"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  tone?: "red" | "neutral" | "dark" | "green";
}

function Badge({ className, variant, tone, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant: tone ?? variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
