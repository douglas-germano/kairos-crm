"use client";

import { FormEvent, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function MessageInput({ onSend, disabled }: { onSend: (content: string) => Promise<void>; disabled?: boolean }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const text = content.trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      await onSend(text);
      setContent("");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit();
  }

  return (
    <form onSubmit={onSubmit} className="border-t border-black/10 bg-white p-3">
      <div className="mx-auto flex max-w-4xl items-end gap-3">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          disabled={disabled || loading}
          placeholder="Responder ao cliente..."
          className="focus-ring min-h-11 flex-1 resize-none rounded-tight border border-black/20 px-3 py-2.5 text-sm"
        />
        <Button type="submit" disabled={disabled || loading || !content.trim()} aria-label="Enviar mensagem">
          <SendHorizontal size={17} />
        </Button>
      </div>
    </form>
  );
}
