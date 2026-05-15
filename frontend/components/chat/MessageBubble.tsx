import { AlertCircle } from "lucide-react";
import type { Message } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

export function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "outbound";
  const failed = message.status === "failed";
  const isAudio = message.content_type === "audio";

  const bubbleClass = cn(
    "max-w-[78%] rounded-card px-3 py-2.5",
    outbound
      ? failed
        ? "bg-red-100 text-red-800"
        : "bg-brand-charcoal text-white"
      : "border border-black/10 bg-white text-brand-charcoal"
  );

  const metaClass = cn(
    "mt-1.5 flex items-center gap-1 text-[11px]",
    outbound ? (failed ? "text-red-500" : "text-white/60") : "text-brand-grey"
  );

  return (
    <div className={cn("mx-auto flex w-full max-w-4xl", outbound ? "justify-end" : "justify-start")}>
      <div className={bubbleClass}>
        {isAudio ? (
          <audio
            controls
            src={`data:audio/ogg;base64,${message.content}`}
            className="h-10 w-56 max-w-full"
            preload="metadata"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        )}
        <div className={metaClass}>
          {failed && <AlertCircle size={11} />}
          {failed ? "Falha na entrega" : formatDateTime(message.created_at)}
        </div>
      </div>
    </div>
  );
}
