import { Instagram, MessageCircle } from "lucide-react";
import { Channel } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  const Icon = channel === "instagram" ? Instagram : MessageCircle;
  return (
    <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-neutral text-brand-charcoal", className)}>
      <Icon size={17} />
    </span>
  );
}
