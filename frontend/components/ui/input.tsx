import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "focus-ring flex h-10 w-full rounded-card border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink shadow-sm outline-none transition file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-brand-muted hover:border-brand-charcoal/20 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
export { Textarea } from "./textarea";
