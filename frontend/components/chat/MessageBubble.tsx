import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import type { Message } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

function detectMime(b64: string): string {
  try {
    const bytes = atob(b64.slice(0, 32));
    // OGG: starts with "OggS"
    if (bytes.startsWith("OggS")) return "audio/ogg; codecs=opus";
    // WebM/Matroska: starts with 0x1A 0x45 0xDF 0xA3
    if (bytes.charCodeAt(0) === 0x1a && bytes.charCodeAt(1) === 0x45) return "audio/webm; codecs=opus";
    // MP4: bytes 4-7 contain "ftyp"
    if (bytes.slice(4, 8) === "ftyp") return "audio/mp4";
    // MP3: starts with ID3 or sync word 0xFF 0xFB
    if (bytes.startsWith("ID3") || (bytes.charCodeAt(0) === 0xff && bytes.charCodeAt(1) === 0xfb)) return "audio/mpeg";
  } catch {
    // ignore decode errors
  }
  return "audio/ogg; codecs=opus"; // WhatsApp PTT default
}

function AudioPlayer({ content }: { content: string }) {
  const [src, setSrc] = useState<string>("");
  const urlRef = useRef<string>("");

  useEffect(() => {
    try {
      const mime = detectMime(content);
      const binary = atob(content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setSrc(url);
    } catch {
      setSrc("");
    }
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [content]);

  if (!src) return <span className="ui-meta opacity-60">Carregando áudio…</span>;
  return (
    <audio
      controls
      src={src}
      className="h-10 w-56 max-w-full"
      preload="metadata"
    />
  );
}

export function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "outbound";
  const failed = message.status === "failed";
  const isAudio = message.content_type === "audio";

  const bubbleClass = cn(
    "max-w-[78%] rounded-panel px-3.5 py-2.5 shadow-sm",
    outbound
      ? failed
        ? "bg-red-100 text-red-800"
        : "bg-brand-charcoal text-white"
      : "border border-brand-line bg-white text-brand-ink"
  );

  const metaClass = cn(
    "mt-1.5 flex items-center gap-1 text-[11px]",
    outbound ? (failed ? "text-red-500" : "text-white/60") : "text-brand-muted"
  );

  return (
    <div className={cn("mx-auto flex w-full max-w-4xl", outbound ? "justify-end" : "justify-start")}>
      <div className={bubbleClass}>
        {isAudio ? (
          <AudioPlayer content={message.content} />
        ) : (
          <p className="ui-body whitespace-pre-wrap">{message.content}</p>
        )}
        <div className={metaClass}>
          {failed && <AlertCircle size={11} />}
          {failed ? "Falha na entrega" : formatDateTime(message.created_at)}
        </div>
      </div>
    </div>
  );
}
