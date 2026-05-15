import { AlertCircle } from "lucide-react";
import type { Message } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

export function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "outbound";
  const failed = message.status === "failed";

  return (
    <div className={cn("mx-auto flex w-full max-w-4xl", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-card px-3 py-2.5",
          outbound
            ? failed
              ? "bg-red-100 text-red-800"
              : "bg-brand-charcoal text-white"
            : "border border-black/10 bg-white text-brand-charcoal"
        )}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        <div className={cn("mt-1.5 flex items-center gap-1 text-[11px]", outbound ? (failed ? "text-red-500" : "text-white/60") : "text-brand-grey")}>
          {failed && <AlertCircle size={11} />}
          {failed ? "Falha na entrega" : formatDateTime(message.created_at)}
        </div>
      </div>
    </div>
  );
}
