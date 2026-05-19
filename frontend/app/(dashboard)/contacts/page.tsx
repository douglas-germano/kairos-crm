"use client";

export const runtime = "edge";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  MessageCircle, Search, Upload, Users,
  Loader2, AlertCircle, ChevronLeft, ChevronRight, Pencil, Trash2,
} from "lucide-react";
import { swrFetcher, apiFetch, ApiError } from "@/lib/api";
import type { Contact, ContactPage, Conversation } from "@/lib/types";
import { ChannelIcon } from "@/components/ui/ChannelIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/AppShell";
import { cn, initials, formatRelativeTime } from "@/lib/utils";

const AVATAR_PALETTES = [
  "bg-brand-info text-white",
  "bg-brand-success text-white",
  "bg-brand-warning text-brand-ink",
  "bg-brand-red text-white",
  "bg-brand-charcoal text-white",
];

function avatarColor(name: string) {
  return AVATAR_PALETTES[(name.charCodeAt(0) || 0) % AVATAR_PALETTES.length];
}

export default function ContactsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("");
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [startingConv, setStartingConv] = useState<number | null>(null);
  const [deletingContact, setDeletingContact] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (channel) params.set("channel", channel);
  params.set("page", String(page));
  params.set("per_page", "50");

  const { data, isLoading, error, mutate } = useSWR<ContactPage>(
    `/api/contacts?${params.toString()}`,
    swrFetcher
  );
  const contacts = data?.items ?? [];

  async function startConversation(contact: Contact) {
    if (contact.channel !== "whatsapp") return;
    setStartingConv(contact.id);
    try {
      const conv = await apiFetch<Conversation>("/api/conversations/initiate", {
        method: "POST",
        body: JSON.stringify({ phone_number: contact.external_id, name: contact.name ?? "" }),
      });
      router.push(`/conversations?conv=${conv.id}`);
    } catch {
      setStartingConv(null);
    }
  }

  async function deleteContact(contact: Contact) {
    const label = contact.name || contact.external_id;
    const confirmed = window.confirm(`Excluir o contato "${label}" e todas as conversas vinculadas?`);
    if (!confirmed) return;
    setDeletingContact(contact.id);
    try {
      await apiFetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      await mutate();
    } finally {
      setDeletingContact(null);
    }
  }

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader
          eyebrow=""
          title="Contatos"
          action={
            <Button onClick={() => setImportOpen(true)}>
              <Upload size={14} />
              Importar CSV
            </Button>
          }
        />

        {/* Filters */}
        <div className="border-b border-brand-line bg-white px-4 py-3 sm:px-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar por nome ou número..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-1.5">
              {(["", "whatsapp", "instagram"] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => { setChannel(ch); setPage(1); }}
                  className={cn(
                    "focus-ring rounded-card px-3 py-1.5 text-[11px] font-extrabold transition",
                    channel === ch
                      ? "bg-brand-charcoal text-white"
                      : "bg-brand-canvas text-brand-muted hover:bg-brand-neutral hover:text-brand-ink"
                  )}
                >
                  {ch === "" ? "Todos" : ch === "whatsapp" ? "WhatsApp" : "Instagram"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <LoadingSkeleton />
          ) : error ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <AlertCircle size={28} className="text-brand-red" />
              <p className="ui-meta">Erro ao carregar contatos</p>
            </div>
          ) : contacts.length === 0 ? (
            <EmptyState search={search} />
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-brand-line bg-white/95 backdrop-blur">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-muted sm:px-7">
                      Contato
                    </th>
                    <th className="hidden px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-muted md:table-cell">
                      Canal
                    </th>
                    <th className="hidden px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-muted lg:table-cell">
                      Adicionado
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-brand-muted sm:px-7">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-line/60">
                  {contacts.map((contact) => {
                    const name = contact.name || contact.external_id;
                    return (
                      <tr key={contact.id} className="transition-colors hover:bg-brand-canvas/60">
                        <td className="px-4 py-3 sm:px-7">
                          <div className="flex items-center gap-3">
                            <Avatar className={cn("h-8 w-8 text-xs font-black", avatarColor(name))}>
                              <AvatarFallback className={cn("text-xs font-black", avatarColor(name))}>
                                {initials(name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-brand-ink">{name}</p>
                              <p className="truncate text-[11px] text-brand-muted">{contact.external_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <ChannelIcon channel={contact.channel} className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold capitalize text-brand-muted">
                              {contact.channel === "whatsapp" ? "WhatsApp" : "Instagram"}
                            </span>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-brand-muted lg:table-cell">
                          {formatRelativeTime(contact.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right sm:px-7">
                          <div className="flex justify-end gap-1.5">
                            {contact.channel === "whatsapp" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => void startConversation(contact)}
                                    disabled={startingConv === contact.id}
                                  >
                                    {startingConv === contact.id ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <MessageCircle size={13} />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Iniciar conversa</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setEditingContact(contact)}
                                >
                                  <Pencil size={13} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar contato</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 hover:border-brand-red/30 hover:bg-brand-red50 hover:text-brand-red"
                                  onClick={() => void deleteContact(contact)}
                                  disabled={deletingContact === contact.id}
                                >
                                  {deletingContact === contact.id ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={13} />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Excluir contato</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {(data?.pages ?? 1) > 1 && (
                <div className="flex items-center justify-between border-t border-brand-line px-4 py-3 sm:px-7">
                  <p className="text-xs text-brand-muted">
                    {data?.total} contatos · página {data?.page} de {data?.pages}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={page >= (data?.pages ?? 1)}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => void mutate()} />
        <EditContactModal
          contact={editingContact}
          onClose={() => setEditingContact(null)}
          onSaved={() => { setEditingContact(null); void mutate(); }}
        />
      </div>
    </TooltipProvider>
  );
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────

function EditContactModal({
  contact,
  onClose,
  onSaved,
}: {
  contact: Contact | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(contact?.name ?? "");
    setExternalId(contact?.external_id ?? "");
    setError(null);
  }, [contact]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contact) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch<Contact>(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, external_id: externalId }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar contato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!contact} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-canvas">
              <Pencil size={15} className="text-brand-ink" />
            </span>
            <div>
              <DialogTitle>Editar contato</DialogTitle>
              <DialogDescription>
                {contact?.channel === "whatsapp" ? "WhatsApp" : "Instagram"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name-edit">Nome</Label>
              <Input
                id="contact-name-edit"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-external-id">Identificador</Label>
              <Input
                id="contact-external-id"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Import Modal ───────────────────────────────────────────────────────────────

function ImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: { row: number; reason: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await apiFetch<{ imported: number; skipped: number; errors: { row: number; reason: string }[] }>(
        "/api/contacts/import",
        { method: "POST", body: form }
      );
      setResult(res);
      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao importar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-canvas">
              <Upload size={15} className="text-brand-ink" />
            </span>
            <div>
              <DialogTitle>Importar contatos</DialogTitle>
              <DialogDescription>CSV com colunas: name, phone[, channel]</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-card border border-brand-line bg-brand-canvas px-3 py-2.5 font-mono text-[11px] text-brand-muted">
            name,phone,channel<br />
            João Silva,5511999999999,whatsapp<br />
            Maria Souza,5521988888888,whatsapp
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="csv-file">
              Arquivo CSV <span className="text-brand-red">*</span>
            </Label>
            <Input
              id="csv-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={reset}
              className="file:mr-3 file:rounded file:border-0 file:bg-brand-canvas file:px-2 file:py-1 file:text-xs file:font-bold file:text-brand-ink"
            />
          </div>

          {result && (
            <div className="rounded-card border border-brand-success/30 bg-brand-successSoft px-3 py-2.5 text-sm">
              <p className="font-extrabold text-brand-successStrong">
                ✓ {result.imported} contato{result.imported !== 1 ? "s" : ""} importado{result.imported !== 1 ? "s" : ""}
                {result.skipped > 0 && `, ${result.skipped} ignorado${result.skipped !== 1 ? "s" : ""}`}
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-[11px] text-brand-red">
                  {result.errors.slice(0, 5).map((e) => (
                    <li key={e.row}>Linha {e.row}: {e.reason}</li>
                  ))}
                  {result.errors.length > 5 && <li>…e mais {result.errors.length - 5} erros</li>}
                </ul>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose}>
            {result ? "Fechar" : "Cancelar"}
          </Button>
          {!result && (
            <Button onClick={() => void handleUpload()} disabled={loading}>
              {loading ? <><Loader2 size={14} className="animate-spin" /> Importando…</> : "Importar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
      <Users size={32} className="text-brand-muted/40" />
      <div>
        <p className="font-bold text-brand-ink">
          {search ? "Nenhum resultado" : "Sem contatos"}
        </p>
        <p className="mt-1 text-xs text-brand-muted">
          {search
            ? `Nenhum contato encontrado para "${search}"`
            : "Importe um CSV ou inicie conversas para criar contatos."}
        </p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-brand-line/60">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 sm:px-7">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-brand-neutral" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-brand-neutral" />
            <div className="h-2.5 w-1/4 animate-pulse rounded bg-brand-neutral" />
          </div>
        </div>
      ))}
    </div>
  );
}
