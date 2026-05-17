"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, SendHorizontal, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  onSend: (content: string, contentType?: string) => Promise<void>;
  disabled?: boolean;
};

export function MessageInput({ onSend, disabled }: Props) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Limpa o timer ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function submit() {
    const text = content.trim();
    if (!text || loading) return;
    setLoading(true);
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
    <form onSubmit={onSubmit} className="border-t border-brand-line bg-white/95 p-3 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-end gap-2">
        {recording ? (
          // Estado de gravação
          <>
            <div className="flex flex-1 items-center gap-3 rounded-card border border-brand-red200 bg-brand-red50 px-3 py-2.5">
              <span className="flex h-2 w-2 rounded-full bg-brand-red animate-pulse" />
              <span className="item-title text-brand-red">{formatTime(recordingSeconds)}</span>
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
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              disabled={disabled || loading}
              placeholder="Responder ao cliente..."
              rows={1}
              className="focus-ring min-h-[44px] flex-1 resize-none rounded-card border border-brand-line bg-brand-canvas px-3.5 py-2.5 text-sm font-medium text-brand-ink placeholder:text-brand-muted"
            />
            {/* Microfone */}
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={disabled || loading || content.trim().length > 0}
              className="focus-ring flex h-10 w-10 items-center justify-center rounded-card border border-brand-line text-brand-muted hover:bg-brand-canvas disabled:opacity-30"
              title="Gravar áudio"
            >
              <Mic size={18} />
            </button>
            {/* Enviar texto */}
            <Button
              type="submit"
              disabled={disabled || loading || !content.trim()}
              aria-label="Enviar mensagem"
            >
              <SendHorizontal size={17} />
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
