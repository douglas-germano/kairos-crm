"use client";

export const runtime = "edge";

import { useState } from "react";
import type { FormEvent } from "react";
import useSWR from "swr";
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Clock,
  Loader2, Megaphone, Play, Plus, Trash2, XCircle,
} from "lucide-react";
import { swrFetcher, apiFetch, ApiError } from "@/lib/api";
import type { Broadcast, BroadcastDetail, Contact, ContactPage } from "@/lib/types";
import { Button } from "@/components/ui/button";
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
import { PageHeader } from "@/components/layout/AppShell";
import { cn, formatRelativeTime } from "@/lib/utils";

const STATUS_CONFIG = {
  draft:     { label: "Rascunho",    color: "text-brand-muted",         bg: "bg-brand-canvas",      icon: Clock },
  sending:   { label: "Enviando…",   color: "text-brand-warningStrong", bg: "bg-brand-warningSoft",  icon: Loader2 },
  completed: { label: "Concluído",   color: "text-brand-successStrong", bg: "bg-brand-successSoft",  icon: CheckCircle2 },
  failed:    { label: "Falhou",      color: "text-brand-red",           bg: "bg-red-50",             icon: XCircle },
} as const;

function StatusBadge({ status }: { status: Broadcast["status"] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold", cfg.color, cfg.bg)}>
      <Icon size={11} className={status === "sending" ? "animate-spin" : ""} />
      {cfg.label}
    </span>
  );
}

function ProgressBar({ sent, failed, total }: { sent: number; failed: number; total: number }) {
  if (total === 0) return null;
  const sentPct = Math.round((sent / total) * 100);
  const failedPct = Math.round((failed / total) * 100);
  return (
    <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-brand-line">
      <div className="bg-brand-success transition-all" style={{ width: `${sentPct}%` }} />
      <div className="bg-brand-red transition-all" style={{ width: `${failedPct}%` }} />
    </div>
  );
}

export default function BroadcastsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: broadcasts, isLoading, error, mutate } = useSWR<Broadcast[]>(
    "/api/broadcasts",
    swrFetcher,
    { refreshInterval: 5000 }
  );

  async function handleSend(id: number) {
    setSendingId(id);
    try {
      await apiFetch(`/api/broadcasts/${id}/send`, { method: "POST" });
      await mutate();
    } finally {
      setSendingId(null);
    }
  }

  async function handleDelete(broadcast: Broadcast) {
    const confirmed = window.confirm(`Excluir o broadcast "${broadcast.name}"?`);
    if (!confirmed) return;
    setDeletingId(broadcast.id);
    try {
      await apiFetch(`/api/broadcasts/${broadcast.id}`, { method: "DELETE" });
      await mutate();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        eyebrow=""
        title="Broadcasts"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            Novo broadcast
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState />
        ) : !broadcasts?.length ? (
          <EmptyState onNew={() => setCreateOpen(true)} />
        ) : (
          <div className="divide-y divide-brand-line/60">
            {broadcasts.map((b) => (
              <BroadcastRow
                key={b.id}
                broadcast={b}
                expanded={expandedId === b.id}
                onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)}
                onSend={() => void handleSend(b.id)}
                onDelete={() => void handleDelete(b)}
                sending={sendingId === b.id}
                deleting={deletingId === b.id}
              />
            ))}
          </div>
        )}
      </div>

      <CreateBroadcastModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); void mutate(); }}
      />
    </div>
  );
}

function BroadcastRow({
  broadcast: b, expanded, onToggle, onSend, onDelete, sending, deleting,
}: {
  broadcast: Broadcast;
  expanded: boolean;
  onToggle: () => void;
  onSend: () => void;
  onDelete: () => void;
  sending: boolean;
  deleting: boolean;
}) {
  const { data: detail } = useSWR<BroadcastDetail>(
    expanded ? `/api/broadcasts/${b.id}` : null,
    swrFetcher
  );
  const canSend = b.status === "draft" || b.status === "failed";
  const canDelete = b.status !== "sending";

  return (
    <div className="px-4 py-4 sm:px-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black text-brand-ink">{b.name}</span>
            <StatusBadge status={b.status} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-brand-muted">{b.message}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-brand-muted">
            <span>{b.total_count} destinatário{b.total_count !== 1 ? "s" : ""}</span>
            {(b.status === "sending" || b.status === "completed") && (
              <>
                <span className="text-brand-success">{b.sent_count} enviados</span>
                {b.failed_count > 0 && <span className="text-brand-red">{b.failed_count} falhas</span>}
              </>
            )}
            <span>· {formatRelativeTime(b.created_at)}</span>
          </div>
          {(b.status === "sending" || b.status === "completed") && (
            <ProgressBar sent={b.sent_count} failed={b.failed_count} total={b.total_count} />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {canSend && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 hover:border-brand-success/40 hover:bg-brand-successSoft hover:text-brand-successStrong"
              onClick={onSend}
              disabled={sending}
              title="Disparar broadcast"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 hover:border-red-200 hover:bg-red-50 hover:text-brand-red"
              onClick={onDelete}
              disabled={deleting}
              title="Excluir"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onToggle}
            title={expanded ? "Recolher" : "Ver destinatários"}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 rounded-card border border-brand-line bg-brand-canvas">
          {!detail ? (
            <div className="flex h-16 items-center justify-center">
              <Loader2 size={16} className="animate-spin text-brand-muted" />
            </div>
          ) : detail.recipients.length === 0 ? (
            <p className="p-4 text-sm text-brand-muted">Sem destinatários.</p>
          ) : (
            <ul className="divide-y divide-brand-line/60">
              {detail.recipients.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-brand-ink">
                      {r.contact?.name || r.contact?.external_id || `#${r.contact_id}`}
                    </p>
                    {r.contact?.external_id && (
                      <p className="truncate text-[11px] text-brand-muted">{r.contact.external_id}</p>
                    )}
                    {r.error_message && (
                      <p className="truncate text-[11px] text-brand-red">{r.error_message}</p>
                    )}
                  </div>
                  <RecipientStatus status={r.status} />
                </li>
              ))}
              {detail.total_count > 50 && (
                <li className="px-4 py-2 text-[11px] text-brand-muted">
                  Mostrando 50 de {detail.total_count} destinatários
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function RecipientStatus({ status }: { status: "pending" | "sent" | "failed" }) {
  if (status === "sent") return <CheckCircle2 size={14} className="shrink-0 text-brand-success" />;
  if (status === "failed") return <XCircle size={14} className="shrink-0 text-brand-red" />;
  return <Clock size={14} className="shrink-0 text-brand-muted" />;
}

function CreateBroadcastModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const params = new URLSearchParams({ channel: "whatsapp", per_page: "100" });
  if (contactSearch) params.set("search", contactSearch);

  const { data: contactPage, isLoading: loadingContacts } = useSWR<ContactPage>(
    open ? `/api/contacts?${params.toString()}` : null,
    swrFetcher
  );
  const contacts = contactPage?.items ?? [];

  function toggleContact(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (contacts.every((c) => selectedIds.has(c.id))) {
      setSelectedIds((prev) => { const next = new Set(prev); contacts.forEach((c) => next.delete(c.id)); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); contacts.forEach((c) => next.add(c.id)); return next; });
    }
  }

  function reset() {
    setName(""); setMessage(""); setContactSearch(""); setSelectedIds(new Set()); setApiError(null);
  }

  function handleClose() { reset(); onClose(); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (selectedIds.size === 0) { setApiError("Selecione ao menos um contato."); return; }
    setSaving(true);
    try {
      await apiFetch("/api/broadcasts", {
        method: "POST",
        body: JSON.stringify({ name, message, contact_ids: Array.from(selectedIds) }),
      });
      reset();
      onCreated();
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : "Erro ao criar broadcast");
    } finally {
      setSaving(false);
    }
  }

  const allSelected = contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col p-0">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-canvas">
              <Megaphone size={15} className="text-brand-ink" />
            </span>
            <div>
              <DialogTitle>Novo broadcast</DialogTitle>
              <DialogDescription>Disparo em massa via WhatsApp</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-name">
                Nome do broadcast <span className="text-brand-red">*</span>
              </Label>
              <Input
                id="broadcast-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Promoção de maio"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="broadcast-message">
                Mensagem <span className="text-brand-red">*</span>
              </Label>
              <Textarea
                id="broadcast-message"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Olá! Temos uma novidade especial para você…"
                className="min-h-[100px]"
              />
              <p className="text-right text-[11px] text-brand-muted">{message.length} caracteres</p>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>
                  Destinatários (WhatsApp)
                  {selectedIds.size > 0 && (
                    <span className="ml-1.5 rounded-full bg-brand-red px-1.5 py-0.5 text-[10px] text-white">
                      {selectedIds.size}
                    </span>
                  )}
                </Label>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[11px] font-bold text-brand-red hover:underline"
                >
                  {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                </button>
              </div>

              <Input
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Buscar contato…"
              />

              <div className="max-h-52 overflow-y-auto rounded-card border border-brand-line">
                {loadingContacts ? (
                  <div className="flex h-20 items-center justify-center">
                    <Loader2 size={16} className="animate-spin text-brand-muted" />
                  </div>
                ) : contacts.length === 0 ? (
                  <p className="p-4 text-center text-sm text-brand-muted">Nenhum contato WhatsApp encontrado</p>
                ) : (
                  <ul className="divide-y divide-brand-line/60">
                    {contacts.map((c) => (
                      <ContactItem
                        key={c.id}
                        contact={c}
                        selected={selectedIds.has(c.id)}
                        onToggle={() => toggleContact(c.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {apiError && (
              <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                {apiError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !name.trim() || !message.trim()}>
              {saving ? (
                <><Loader2 size={14} className="animate-spin" /> Criando…</>
              ) : (
                `Criar broadcast${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContactItem({ contact, selected, onToggle }: { contact: Contact; selected: boolean; onToggle: () => void }) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-brand-canvas">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="h-4 w-4 rounded border-brand-line text-brand-red accent-brand-red"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-brand-ink">{contact.name || contact.external_id}</p>
          {contact.name && <p className="truncate text-[11px] text-brand-muted">{contact.external_id}</p>}
        </div>
      </label>
    </li>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
      <Megaphone size={36} className="text-brand-muted/30" />
      <div>
        <p className="font-black text-brand-ink">Nenhum broadcast</p>
        <p className="mt-1 text-sm text-brand-muted">Crie um disparo em massa para seus contatos WhatsApp.</p>
      </div>
      <Button onClick={onNew}><Plus size={14} />Criar broadcast</Button>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3">
      <AlertCircle size={28} className="text-brand-red" />
      <p className="text-sm text-brand-muted">Erro ao carregar broadcasts</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-brand-line/60 px-4 sm:px-7">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2 py-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-brand-neutral" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-brand-neutral" />
          </div>
          <div className="h-3 w-2/3 animate-pulse rounded bg-brand-neutral" />
          <div className="h-2.5 w-1/4 animate-pulse rounded bg-brand-neutral" />
        </div>
      ))}
    </div>
  );
}
