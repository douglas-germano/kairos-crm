import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[2px] text-sm font-extrabold transition duration-fast ease-brand disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-brand-red bg-brand-red text-white hover:bg-brand-redDark active:opacity-90",
        red: "border border-brand-red bg-brand-red text-white hover:bg-brand-redDark active:opacity-90",
        destructive:
          "border border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 active:opacity-90",
        outline:
          "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground active:opacity-90",
        secondary:
          "border border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/80 active:opacity-90",
        ghost:
          "border border-brand-line bg-brand-white text-brand-ink hover:border-brand-charcoal/25 hover:bg-brand-canvas active:opacity-90",
        link: "rounded-none border-0 text-primary underline-offset-4 hover:underline",
        pill: "rounded-[60px] border border-brand-red bg-brand-red text-white hover:bg-brand-redDark active:opacity-90",
        dark: "border border-brand-charcoal bg-brand-charcoal text-white hover:bg-brand-ink active:opacity-90",
        subtle: "rounded-[60px] border border-transparent bg-brand-red50 text-brand-red hover:bg-brand-red100 active:opacity-90"
      },
      size: {
        default: "min-h-10 px-3.5 py-2.5",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10 rounded-full p-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
