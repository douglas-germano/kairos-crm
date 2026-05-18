"use client";

export const runtime = "edge";

import { useRef, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  MessageCircle, Search, Upload, Users, Loader2,
  AlertCircle, ChevronLeft, ChevronRight,
} from "lucide-react";
import { swrFetcher, apiFetch, ApiError } from "@/lib/api";
import type { Contact, ContactPage, Conversation } from "@/lib/types";
import { ChannelIcon } from "@/components/ui/ChannelIcon";
import { Button } from "@/components/ui/Button";
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
  const [startingConv, setStartingConv] = useState<number | null>(null);

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

  function handleSearchChange(val: string) {
    setSearch(val);
    setPage(1);
  }

  function handleChannelChange(val: string) {
    setChannel(val);
    setPage(1);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        eyebrow=""
        title="Contatos"
        action={
          <Button onClick={() => setImportOpen(true)} className="flex items-center gap-2">
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
            <input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar por nome ou número..."
              className="focus-ring w-full rounded-card border border-brand-line bg-brand-canvas py-2 pl-9 pr-3 text-sm font-medium placeholder:text-brand-muted"
            />
          </div>
          <div className="flex gap-1.5">
            {(["", "whatsapp", "instagram"] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => handleChannelChange(ch)}
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
                  const palette = avatarColor(name);
                  return (
                    <tr key={contact.id} className="transition-colors hover:bg-brand-canvas/60">
                      <td className="px-4 py-3 sm:px-7">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black",
                              palette
                            )}
                          >
                            {initials(name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-brand-ink">{name}</p>
                            <p className="truncate text-[11px] text-brand-muted">
                              {contact.external_id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <ChannelIcon channel={contact.channel} className="h-3.5 w-3.5" />
                          <span className="text-xs font-semibold text-brand-muted capitalize">
                            {contact.channel === "whatsapp" ? "WhatsApp" : "Instagram"}
                          </span>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-brand-muted lg:table-cell">
                        {formatRelativeTime(contact.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-7">
                        {contact.channel === "whatsapp" && (
                          <button
                            onClick={() => void startConversation(contact)}
                            disabled={startingConv === contact.id}
                            title="Iniciar conversa"
                            className="focus-ring inline-flex items-center gap-1.5 rounded-card border border-brand-line bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-brand-muted transition hover:border-brand-charcoal/20 hover:text-brand-ink disabled:opacity-50"
                          >
                            {startingConv === contact.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <MessageCircle size={12} />
                            )}
                            <span className="hidden sm:inline">Conversar</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {(data?.pages ?? 1) > 1 && (
              <div className="flex items-center justify-between border-t border-brand-line px-4 py-3 sm:px-7">
                <p className="text-xs text-brand-muted">
                  {data?.total} contatos · página {data?.page} de {data?.pages}
                </p>
                <div className="flex gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="focus-ring rounded-card border border-brand-line p-1.5 text-brand-muted transition hover:text-brand-ink disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={page >= (data?.pages ?? 1)}
                    onClick={() => setPage((p) => p + 1)}
                    className="focus-ring rounded-card border border-brand-line p-1.5 text-brand-muted transition hover:text-brand-ink disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => void mutate()} />
    </div>
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

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) handleClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="w-full max-w-lg rounded-panel border border-brand-line bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-canvas text-brand-ink">
              <Upload size={15} />
            </span>
            <div>
              <h2 className="text-sm font-black text-brand-ink">Importar contatos</h2>
              <p className="text-[11px] text-brand-muted">CSV com colunas: name, phone[, channel]</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Template hint */}
          <div className="rounded-card border border-brand-line bg-brand-canvas px-3 py-2.5 font-mono text-[11px] text-brand-muted">
            name,phone,channel<br />
            João Silva,5511999999999,whatsapp<br />
            Maria Souza,5521988888888,whatsapp
          </div>

          {/* File input */}
          <div>
            <label className="mb-1.5 block text-xs font-extrabold text-brand-ink">
              Arquivo CSV <span className="text-brand-red">*</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="focus-ring w-full rounded-card border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink file:mr-3 file:rounded file:border-0 file:bg-brand-canvas file:px-2 file:py-1 file:text-xs file:font-bold file:text-brand-ink"
              onChange={reset}
            />
          </div>

          {/* Result */}
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

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={handleClose}>
              {result ? "Fechar" : "Cancelar"}
            </Button>
            {!result && (
              <Button onClick={() => void handleUpload()} disabled={loading}>
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Importando…</>
                ) : (
                  "Importar"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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
