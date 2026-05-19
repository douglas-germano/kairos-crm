import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[32px] border px-2.5 py-1 text-[11px] font-extrabold uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-brand-line bg-white text-brand-muted",
        red: "border-red-200 bg-red-50 text-brand-red",
        neutral: "border-brand-line bg-white text-brand-muted",
        dark: "border-transparent bg-brand-charcoal text-white",
        green: "border-emerald-200 bg-emerald-50 text-emerald-700"
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
