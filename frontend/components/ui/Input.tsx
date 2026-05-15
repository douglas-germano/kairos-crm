import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "focus-ring w-full rounded-tight border border-[#333333] bg-white px-3 py-3 text-sm text-brand-charcoal placeholder:text-brand-grey",
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
        "focus-ring min-h-28 w-full resize-none rounded-tight border border-[#333333] bg-white px-3 py-3 text-sm text-brand-charcoal placeholder:text-brand-grey",
        className
      )}
      {...props}
    />
  );
}
