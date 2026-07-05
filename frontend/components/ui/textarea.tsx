import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "focus-ring flex min-h-28 w-full resize-none rounded-[2px] border border-brand-line bg-white px-3.5 py-3 text-sm font-medium text-brand-ink outline-none transition duration-fast ease-brand placeholder:text-brand-muted hover:border-brand-charcoal/40 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
