import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "focus-ring h-10 w-full rounded-card border border-brand-line bg-white px-3.5 text-sm font-medium text-brand-ink shadow-sm outline-none transition placeholder:text-brand-muted hover:border-brand-charcoal/20",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "focus-ring min-h-28 w-full resize-none rounded-card border border-brand-line bg-white px-3.5 py-3 text-sm font-medium text-brand-ink shadow-sm outline-none transition placeholder:text-brand-muted hover:border-brand-charcoal/20",
        className
      )}
      {...props}
    />
  );
}
