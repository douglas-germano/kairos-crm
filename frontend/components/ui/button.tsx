import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-card text-sm font-semibold transition duration-fast ease-brand active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primário — accent violeta sólido.
        default: "bg-brand-red text-white hover:bg-brand-redDark hover:shadow-glow",
        red: "bg-brand-red text-white hover:bg-brand-redDark hover:shadow-glow",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Contorno neutro — botões de ícone/ação secundária.
        outline: "border border-brand-line bg-brand-white text-brand-ink hover:border-brand-lineStrong hover:bg-brand-canvas",
        secondary: "border border-brand-line bg-brand-canvas text-brand-ink hover:bg-brand-neutral",
        // Secundário/cancelar — branco com borda fina.
        ghost: "border border-brand-line bg-brand-white text-brand-ink hover:border-brand-lineStrong hover:bg-brand-canvas",
        link: "text-brand-red underline-offset-4 hover:underline",
        pill: "rounded-pill bg-brand-red text-white hover:bg-brand-redDark hover:shadow-glow",
        dark: "bg-brand-charcoal text-white hover:bg-brand-ink",
        subtle: "bg-brand-red50 text-brand-red hover:bg-brand-red100"
      },
      size: {
        default: "h-10 px-3.5 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
        icon: "h-10 w-10 p-0"
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
