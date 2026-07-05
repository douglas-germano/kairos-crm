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

function resolveMediaSrc(content: string, mimePrefix = "image/jpeg"): string {
  if (!content) return "";
  if (content.startsWith("http://") || content.startsWith("https://")) return content;
  if (content.startsWith("data:")) return content;
  // Assume base64
  return `data:${mimePrefix};base64,${content}`;
}

function isPlaceholder(content: string): boolean {
  return content.startsWith("[") && content.endsWith("]");
}

function AudioPlayer({ content }: { content: string }) {
  const [src, setSrc] = useState<string>("");
  const [failed, setFailed] = useState(false);
  const urlRef = useRef<string>("");

  useEffect(() => {
    setFailed(false);
    setSrc("");
    try {
      const raw = content.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
      const mime = detectMime(raw);
      const binary = atob(raw);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setSrc(url);
    } catch {
      setFailed(true);
    }
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [content]);

  if (failed) return (
    <span className="flex items-center gap-1.5 ui-meta opacity-70">
      🎙️ Mensagem de voz
    </span>
  );
  if (!src) return (
    <span className="flex items-center gap-1.5 ui-meta opacity-60">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
      Carregando áudio…
    </span>
  );
  return (
    <audio
      controls
      src={src}
      className="h-10 w-56 max-w-full"
      preload="metadata"
    />
  );
}

function MediaImage({
  content,
  alt,
  placeholder,
  className,
}: {
  content: string;
  alt: string;
  placeholder: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [content]);

  if (isPlaceholder(content) || failed) {
    return (
      <span className="flex items-center gap-1.5 ui-meta opacity-70">
        {placeholder}
      </span>
    );
  }

  return (
    <img
      src={resolveMediaSrc(content)}
      alt={alt}
      className={cn("max-w-full rounded-lg object-contain", className)}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

function VideoPlayer({ content }: { content: string }) {
  if (isPlaceholder(content)) {
    return (
      <span className="flex items-center gap-1.5 ui-meta opacity-70">
        🎬 Vídeo
      </span>
    );
  }
  return (
    <video
      controls
      src={content}
      className="max-w-full max-h-64 rounded-lg"
      preload="metadata"
    />
  );
}

export function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "outbound";
  const failed = message.status === "failed";
  const { content_type, content } = message;

  const isAudio = content_type === "audio";
  const isImage = content_type === "image";
  const isSticker = content_type === "sticker";
  const isVideo = content_type === "video";

  // Stickers render without the standard bubble padding / background
  const isNakedMedia = isSticker;

  const bubbleClass = cn(
    "max-w-[78%] rounded-panel",
    isNakedMedia ? "" : "px-3.5 py-2.5",
    outbound
      ? failed
        ? "bg-brand-red100 text-brand-red"
        : "bg-brand-charcoal text-white"
      : isNakedMedia
        ? ""
        : "border border-brand-line bg-white text-brand-ink"
  );

  const metaClass = cn(
    "mt-1.5 flex items-center gap-1 text-[11px]",
    outbound ? (failed ? "text-brand-red" : "text-white/60") : "text-brand-muted"
  );

  function renderContent() {
    const caption = message.caption?.trim();
    const captionNode = caption ? (
      <p className={cn("ui-body mt-2 whitespace-pre-wrap", outbound ? "text-white" : "text-brand-ink")}>
        {caption}
      </p>
    ) : null;

    if (isAudio) return (
      <>
        <AudioPlayer content={content} />
        {captionNode}
      </>
    );
    if (isImage) return (
      <>
        <MediaImage content={content} alt="Imagem" placeholder="🖼️ Imagem" className="max-h-64" />
        {captionNode}
      </>
    );
    if (isSticker) return (
      <>
        <MediaImage content={content} alt="Figurinha" placeholder="😀 Figurinha" className="max-h-32 max-w-[128px]" />
        {captionNode}
      </>
    );
    if (isVideo) return (
      <>
        <VideoPlayer content={content} />
        {captionNode}
      </>
    );
    return <p className="ui-body whitespace-pre-wrap">{content}</p>;
  }

  return (
    <div className={cn("mx-auto flex w-full max-w-4xl", outbound ? "justify-end" : "justify-start")}>
      <div className={bubbleClass}>
        {renderContent()}
        {!isNakedMedia && (
          <div className={metaClass}>
            {failed && <AlertCircle size={11} />}
            {failed ? "Falha na entrega" : formatDateTime(message.created_at)}
          </div>
        )}
        {isNakedMedia && (
          <div className={cn(metaClass, "px-1")}>
            {formatDateTime(message.created_at)}
          </div>
        )}
      </div>
    </div>
  );
}
