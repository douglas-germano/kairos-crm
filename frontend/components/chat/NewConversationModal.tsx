"use client";

import { useEffect, useRef, useState } from "react";
import { X, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch, ApiError } from "@/lib/api";
import type { Conversation } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
};

export function NewConversationModal({ open, onClose, onCreated }: Props) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPhone("");
      setName("");
      setMessage("");
      setError(null);
      setTimeout(() => phoneRef.current?.focus(), 50);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const conv = await apiFetch<Conversation>("/api/conversations/initiate", {
        method: "POST",
        body: JSON.stringify({
          phone_number: phone.trim(),
          name: name.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });
      onCreated(conv);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao iniciar conversa");
    } finally {
      setLoading(false);
    }
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="w-full max-w-md rounded-panel border border-brand-line bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-successSoft text-brand-successStrong">
              <MessageCircle size={16} />
            </span>
            <div>
              <h2 className="text-sm font-black text-brand-ink">Nova conversa</h2>
              <p className="text-[11px] text-brand-muted">WhatsApp</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring flex h-7 w-7 items-center justify-center rounded-full text-brand-muted transition hover:bg-brand-canvas hover:text-brand-ink"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-extrabold text-brand-ink">
              Número <span className="text-brand-red">*</span>
            </label>
            <Input
              ref={phoneRef}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5511999999999"
              required
              disabled={loading}
              className="font-mono"
            />
            <p className="mt-1 text-[11px] text-brand-muted">
              DDI + DDD + número sem espaços ou hífens. Ex: 5511999999999
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-extrabold text-brand-ink">
              Nome do contato <span className="text-brand-muted font-medium">(opcional)</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="João Silva"
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-extrabold text-brand-ink">
              Mensagem inicial <span className="text-brand-muted font-medium">(opcional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Olá! Gostaria de falar sobre..."
              disabled={loading}
              rows={3}
              className="focus-ring w-full resize-none rounded-card border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-muted disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !phone.trim()}>
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Iniciando...
                </>
              ) : (
                "Iniciar conversa"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
