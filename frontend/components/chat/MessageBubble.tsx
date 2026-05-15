import type { Message } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

export function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "outbound";
  return (
    <div className={cn("mx-auto flex w-full max-w-4xl", outbound ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[78%] rounded-card px-3 py-2.5", outbound ? "bg-brand-charcoal text-white" : "border border-black/10 bg-white text-brand-charcoal")}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        <div className={cn("mt-2 text-[11px]", outbound ? "text-white/60" : "text-brand-grey")}>{formatDateTime(message.created_at)}</div>
      </div>
    </div>
  );
}
