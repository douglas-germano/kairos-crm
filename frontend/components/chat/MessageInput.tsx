"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { FileText, Mic, MicOff, Paperclip, SendHorizontal, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { emitTyping } from "@/lib/socket";

type SendOptions = { caption?: string; fileName?: string };

type Props = {
  onSend: (content: string, contentType?: string, options?: SendOptions) => Promise<void>;
  disabled?: boolean;
  workspaceId?: number;
  conversationId?: number;
};

const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;
const TYPING_STOP_DELAY = 2000;

type Attachment = {
  file: File;
  dataUrl: string;
  contentType: "image" | "video" | "template";
};

function attachmentContentType(mime: string): "image" | "video" | "template" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "template";
}

export function MessageInput({ onSend, disabled, workspaceId, conversationId }: Props) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingActiveRef = useRef(false);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpa os timers ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      stopTyping();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Para de sinalizar "digitando" ao trocar de conversa
  useEffect(() => {
    stopTyping();
    setAttachment(null);
    setAttachmentError(null);
    setContent("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  function notifyTyping() {
    if (!workspaceId || !conversationId) return;
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      emitTyping(workspaceId, conversationId, true);
    }
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(stopTyping, TYPING_STOP_DELAY);
  }

  function stopTyping() {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (typingActiveRef.current && workspaceId && conversationId) {
      typingActiveRef.current = false;
      emitTyping(workspaceId, conversationId, false);
    }
  }

  async function submit() {
    if (loading) return;
    if (attachment) {
      setLoading(true);
      stopTyping();
      try {
        await onSend(attachment.dataUrl, attachment.contentType, {
          caption: content.trim() || undefined,
          fileName: attachment.file.name,
        });
        setAttachment(null);
        setContent("");
      } finally {
        setLoading(false);
      }
      return;
    }

    const text = content.trim();
    if (!text) return;
    setLoading(true);
    stopTyping();
    try {
      await onSend(text, "text");
      setContent("");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit();
  }

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAttachmentError(null);

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError("Arquivo excede o tamanho máximo de 16MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setAttachment({ file, dataUrl, contentType: attachmentContentType(file.type) });
    };
    reader.onerror = () => setAttachmentError("Não foi possível ler o arquivo selecionado.");
    reader.readAsDataURL(file);
  }

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingSeconds(0);

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          // Remove o prefixo "data:...;base64,"
          const base64 = dataUrl.split(",")[1];
          if (base64) {
            setLoading(true);
            try {
              await onSend(base64, "audio");
            } finally {
              setLoading(false);
            }
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);

      // Contador de segundos
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      alert("Não foi possível acessar o microfone.");
    }
  }, [onSend]);

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function cancelRecording() {
    if (mediaRecorderRef.current) {
      // Remove o handler onstop para não enviar
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setRecordingSeconds(0);
    chunksRef.current = [];
  }

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <form onSubmit={onSubmit} className="border-t border-brand-line bg-brand-white p-3">
      <div className="mx-auto max-w-4xl">
        {attachmentError && (
          <div className="mb-2 flex items-center justify-between rounded-card bg-brand-dangerSoft px-3 py-1.5 text-xs font-semibold text-brand-danger">
            <span>{attachmentError}</span>
            <button type="button" onClick={() => setAttachmentError(null)} aria-label="Fechar erro">
              <X size={13} />
            </button>
          </div>
        )}

        {attachment && (
          <div className="mb-2 flex items-center gap-2 rounded-card border border-brand-line bg-brand-canvas px-3 py-2">
            {attachment.contentType === "image" ? (
              <img src={attachment.dataUrl} alt="Prévia" className="h-10 w-10 rounded object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded bg-brand-neutral text-brand-muted">
                <FileText size={18} />
              </span>
            )}
            <span className="ui-meta flex-1 truncate">{attachment.file.name}</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              disabled={loading}
              className="focus-ring flex h-7 w-7 items-center justify-center rounded-full text-brand-muted hover:bg-brand-neutral"
              aria-label="Remover anexo"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {recording ? (
            // Estado de gravação
            <>
              <div className="flex flex-1 items-center gap-3 rounded-card border border-brand-danger/30 bg-brand-dangerSoft px-3 py-2.5">
                <span className="flex h-2 w-2 rounded-full bg-brand-danger animate-pulse" />
                <span className="item-title text-brand-danger">{formatTime(recordingSeconds)}</span>
                <span className="ui-meta">Gravando</span>
              </div>
              {/* Cancelar */}
              <button
                type="button"
                onClick={cancelRecording}
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-card border border-brand-line text-brand-muted hover:bg-brand-canvas"
                title="Cancelar"
              >
                <MicOff size={18} />
              </button>
              {/* Parar e enviar */}
              <button
                type="button"
                onClick={stopRecording}
                disabled={loading}
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-card bg-brand-red text-white hover:bg-brand-redDark disabled:opacity-50"
                title="Parar e enviar"
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Square size={16} fill="currentColor" />
                )}
              </button>
            </>
          ) : (
            // Estado normal
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
                onChange={onPickFile}
              />
              {/* Anexar arquivo */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || loading}
                className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-card border border-brand-line text-brand-muted hover:bg-brand-canvas disabled:opacity-30"
                title="Anexar arquivo"
              >
                <Paperclip size={18} />
              </button>
              <Textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  if (e.target.value.trim()) notifyTyping();
                  else stopTyping();
                }}
                onBlur={stopTyping}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                disabled={disabled || loading}
                placeholder={attachment ? "Adicionar legenda (opcional)..." : "Responder ao cliente..."}
                rows={1}
                className="min-h-[44px] flex-1 resize-none bg-brand-canvas py-2.5"
              />
              {/* Microfone */}
              {!attachment && (
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  disabled={disabled || loading || content.trim().length > 0}
                  className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-card border border-brand-line text-brand-muted hover:bg-brand-canvas disabled:opacity-30"
                  title="Gravar áudio"
                >
                  <Mic size={18} />
                </button>
              )}
              {/* Enviar */}
              <Button
                type="submit"
                disabled={disabled || loading || (!attachment && !content.trim())}
                aria-label="Enviar mensagem"
              >
                <SendHorizontal size={17} />
              </Button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
