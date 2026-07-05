import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-1 text-[11px] font-extrabold uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Filled neutral pill (32px) — quiet tags, default badge look
        default: "rounded-[32px] border-transparent bg-primary text-primary-foreground",
        secondary: "rounded-[32px] border-transparent bg-secondary text-secondary-foreground",
        destructive: "rounded-[32px] border-transparent bg-destructive text-destructive-foreground",
        neutral: "rounded-[32px] border-brand-line bg-white text-brand-muted",
        dark: "rounded-[32px] border-transparent bg-brand-charcoal text-white",
        green: "rounded-[32px] border-transparent bg-brand-successSoft text-brand-successStrong",
        // Outlined red pill (2px) — inline metadata tags per design-system.md
        outline: "rounded-[2px] border-brand-line bg-white text-brand-muted",
        red: "rounded-[2px] border-brand-red bg-white/80 text-brand-red"
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
