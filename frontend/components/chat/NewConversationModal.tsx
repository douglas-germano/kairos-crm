"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/IconBadge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="flex-row items-center gap-2.5">
          <IconBadge size="sm" tone="success" shrink>
            <MessageCircle size={16} />
          </IconBadge>
          <div>
            <DialogTitle>Nova conversa</DialogTitle>
            <DialogDescription>WhatsApp</DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">
              Número <span className="text-brand-red">*</span>
            </Label>
            <Input
              id="phone"
              ref={phoneRef}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5511999999999"
              required
              disabled={loading}
              className="font-mono"
            />
            <p className="text-[11px] text-brand-muted">
              DDI + DDD + número sem espaços ou hífens. Ex: 5511999999999
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-name">
              Nome do contato{" "}
              <span className="font-medium text-brand-muted">(opcional)</span>
            </Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="João Silva"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="initial-message">
              Mensagem inicial{" "}
              <span className="font-medium text-brand-muted">(opcional)</span>
            </Label>
            <Textarea
              id="initial-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Olá! Gostaria de falar sobre..."
              disabled={loading}
              className="min-h-[80px]"
            />
          </div>

          {error && (
            <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-brand-red">
              {error}
            </p>
          )}

          <DialogFooter className="-mx-5 -mb-4 px-5 py-4">
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
