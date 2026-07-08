"use client";

export const runtime = "edge";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Gauge,
  Images,
  Instagram,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  Pencil,
  Phone,
  Power,
  QrCode,
  RefreshCw,
  Save,
  User,
  Users,
  Wifi,
} from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconBadge } from "@/components/ui/IconBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch, API_URL, swrFetcher } from "@/lib/api";
import type { Integration, MetaInsights, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type QrData = { code: string; pairingCode?: string; count?: number };
type ConnectResponse = { integration_id: number; instance_name: string; qr: QrData };
type WaStatusResponse = {
  state: "open" | "close" | "connecting" | "not_configured";
  integration: Integration | null;
  health?: Record<string, unknown>;
};
type UserData = { id: number; email: string; name: string; created_at: string };

type Section = "perfil" | "workspace" | "canais" | "webhooks";

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "perfil", label: "Perfil", icon: <User size={16} /> },
  { id: "workspace", label: "Workspace", icon: <Building2 size={16} /> },
  { id: "canais", label: "Canais", icon: <Phone size={16} /> },
  { id: "webhooks", label: "Webhooks", icon: <Link2 size={16} /> },
];

// ─── WhatsApp Connection Card (uma conexão/número) ────────────────────────────

function WhatsAppConnectionCard({ integration, onChanged }: { integration: Integration; onChanged: () => void }) {
  const { data: status, mutate: mutateStatus } = useSWR<WaStatusResponse>(
    `/api/settings/whatsapp/status?integration_id=${integration.id}`,
    swrFetcher,
    { refreshInterval: 0 }
  );
  const [phase, setPhase] = useState<"idle" | "loading" | "qr" | "polling" | "error">("idle");
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(integration.name || "");
  const [disconnecting, setDisconnecting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connected = status?.state === "open";

  const stopPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const startPolling = useCallback(() => {
    setPhase("polling");
    setCountdown(60);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { stopPolling(); setPhase("idle"); return 60; }
        return prev - 1;
      });
    }, 1000);
    pollingRef.current = setInterval(async () => {
      try {
        const data = await mutateStatus();
        if (data?.state === "open") { stopPolling(); setPhase("idle"); onChanged(); }
      } catch { /* ignora erros transitórios */ }
    }, 3000);
  }, [stopPolling, mutateStatus, onChanged]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  async function handleGenerateQr() {
    setPhase("loading"); setErrorMsg("");
    try {
      const data = await apiFetch<ConnectResponse>("/api/settings/whatsapp/connect", {
        method: "POST",
        body: JSON.stringify({ integration_id: integration.id }),
      });
      setQrData(data.qr); setPhase("qr");
      stopPolling(); startPolling();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao conectar"); setPhase("error");
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await apiFetch("/api/settings/whatsapp/disconnect", {
        method: "POST",
        body: JSON.stringify({ integration_id: integration.id }),
      });
      onChanged();
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleRename() {
    setRenaming(false);
    const name = nameDraft.trim();
    if (!name || name === integration.name) return;
    await apiFetch(`/api/settings/whatsapp/${integration.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    onChanged();
  }

  const health = getIntegrationHealth(integration);
  const label = integration.name || `Número #${integration.id}`;

  return (
    <div className="surface-card rounded-panel p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-[#25D366] text-white">
            <Phone size={18} />
          </span>
          <div className="min-w-0">
            {renaming ? (
              <Input
                autoFocus
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => void handleRename()}
                onKeyDown={(event) => { if (event.key === "Enter") void handleRename(); }}
                className="h-7 w-40 px-2 py-1 text-sm"
              />
            ) : (
              <button
                type="button"
                onClick={() => { setNameDraft(integration.name || ""); setRenaming(true); }}
                className="item-title flex items-center gap-1.5 truncate hover:text-brand-red"
                title="Renomear conexão"
              >
                <span className="truncate">{label}</span>
                <Pencil size={11} className="shrink-0 text-brand-muted" />
              </button>
            )}
            <p className="ui-meta">Evolution API</p>
          </div>
        </div>
        <Badge tone={connected ? "green" : "neutral"}>{connected ? "ativo" : integration.status}</Badge>
      </div>

      {connected ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-card bg-brand-successSoft p-3">
            <IconBadge tone="successGlass" shrink>
              <Wifi size={18} className="text-brand-successStrong" />
            </IconBadge>
            <div className="min-w-0">
              <div className="ui-label text-brand-successStrong">Conectado e ativo</div>
              <div className="ui-meta truncate font-mono text-brand-successStrong">{String(integration.meta?.instance_name || "")}</div>
            </div>
          </div>
          <div className="grid gap-2 rounded-card border border-brand-line bg-brand-canvas p-3 text-[11px] sm:grid-cols-2">
            <HealthItem label="Webhook" value={formatMetaDate(health.last_webhook_at) || "sem chamadas"} />
            <HealthItem label="Último sync" value={formatMetaDate(health.last_sync_at) || "não executado"} />
            <HealthItem label="Status sync" value={String(health.last_sync_status || "aguardando")} />
            <HealthItem label="Estado" value={String(health.connection_state || health.last_connection_state || "desconhecido")} />
            <HealthItem label="Último JID" value={String(health.last_remote_jid || "-")} wide />
            <HealthItem label="Erro" value={String(health.last_webhook_error || health.last_error || "-")} wide tone={health.last_webhook_error || health.last_error ? "error" : "normal"} />
          </div>
          <Button variant="ghost" onClick={handleDisconnect} disabled={disconnecting} className="w-full">
            {disconnecting ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
            {disconnecting ? "Desconectando" : "Desconectar"}
          </Button>
        </div>
      ) : phase === "loading" ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 size={32} className="animate-spin text-brand-red" />
          <div className="body-muted">Gerando QR code</div>
        </div>
      ) : phase === "qr" || phase === "polling" ? (
        <WhatsAppQrPanel qrData={qrData} countdown={countdown} onRefresh={handleGenerateQr} />
      ) : (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <IconBadge size="xl">
            <Phone size={28} className="text-brand-muted" />
          </IconBadge>
          <div>
            <div className="item-title">Número desconectado</div>
            <div className="body-muted mt-1">Gere o QR code e escaneie com o WhatsApp para vincular</div>
          </div>
          {phase === "error" && <p className="text-xs font-semibold text-brand-danger">{errorMsg}</p>}
          <Button onClick={handleGenerateQr}><QrCode size={17} />Gerar QR Code</Button>
        </div>
      )}
    </div>
  );
}

function WhatsAppQrPanel({ qrData, countdown, onRefresh }: { qrData: QrData | null; countdown: number; onRefresh: () => void }) {
  const qrSrc = qrData?.code
    ? qrData.code.startsWith("data:") ? qrData.code : `data:image/png;base64,${qrData.code}`
    : null;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <div className="item-title">Escaneie com o WhatsApp</div>
        <div className="body-muted mt-0.5 text-sm">Abra o WhatsApp → Dispositivos Conectados → Conectar Dispositivo</div>
      </div>
      {qrSrc ? (
        <div className="relative">
          <img src={qrSrc} alt="QR Code WhatsApp" className="h-52 w-52 rounded-card border border-brand-line object-contain p-2" />
          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-success opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-brand-success" />
          </span>
        </div>
      ) : (
        <div className="flex h-52 w-52 items-center justify-center rounded-card border border-brand-line">
          <QrCode size={48} className="text-brand-neutral" />
        </div>
      )}
      <div className="ui-meta flex items-center gap-2">
        <Loader2 size={13} className="animate-spin" />
        Aguardando conexão ({countdown}s)
      </div>
      <button onClick={onRefresh} className="ui-meta flex items-center gap-1.5 hover:text-brand-ink">
        <RefreshCw size={13} />Atualizar QR code
      </button>
    </div>
  );
}

// ─── WhatsApp Add Card ─────────────────────────────────────────────────────────

function WhatsAppAddCard({ onCreated }: { onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    setLoading(true); setError("");
    try {
      await apiFetch("/api/settings/whatsapp/connect", { method: "POST", body: JSON.stringify({}) });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleAdd()}
      disabled={loading}
      id="btn-wa-add"
      className="focus-ring flex w-full flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-brand-line p-6 text-center text-brand-muted transition hover:border-brand-red/40 hover:text-brand-red disabled:opacity-60"
    >
      {loading ? <Loader2 size={20} className="animate-spin" /> : <Phone size={20} />}
      <span className="item-title">{loading ? "Criando conexão…" : "Adicionar número WhatsApp"}</span>
      {error && <span className="text-xs font-semibold text-brand-danger">{error}</span>}
    </button>
  );
}

function HealthItem({
  label,
  value,
  wide = false,
  tone = "normal",
}: {
  label: string;
  value: string;
  wide?: boolean;
  tone?: "normal" | "error";
}) {
  return (
    <div className={wide ? "min-w-0 sm:col-span-2" : "min-w-0"}>
      <div className="ui-meta font-bold uppercase tracking-normal text-brand-muted">{label}</div>
      <div className={cn(
        "truncate font-mono text-[11px]",
        tone === "error" ? "text-brand-danger" : "text-brand-ink"
      )}>
        {value}
      </div>
    </div>
  );
}

function getIntegrationHealth(integration: Integration): Record<string, unknown> {
  const meta = integration.meta || {};
  const health = meta.health;
  return health && typeof health === "object" && !Array.isArray(health)
    ? health as Record<string, unknown>
    : {};
}

function formatMetaDate(value: unknown): string {
  if (!value || typeof value !== "string") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Instagram Section ────────────────────────────────────────────────────────

function InstagramSection({ integration, onDisconnect }: { integration: Integration | undefined; onDisconnect: () => void }) {
  const [disconnecting, setDisconnecting] = useState(false);
  const connected = integration?.status === "active";

  async function handleDisconnect() {
    if (!integration) return;
    setDisconnecting(true);
    try { await apiFetch(`/api/integrations/${integration.id}`, { method: "DELETE" }); onDisconnect(); }
    finally { setDisconnecting(false); }
  }

  return (
    <div className="surface-card rounded-panel p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-card bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white">
            <Instagram size={18} />
          </span>
          <div>
            <h3 className="item-title">Instagram</h3>
            <p className="ui-meta">Meta Graph API</p>
          </div>
        </div>
        <Badge tone={connected ? "green" : "neutral"}>{connected ? "ativo" : integration?.status || "inativo"}</Badge>
      </div>

      {connected && integration ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-card bg-brand-successSoft p-3">
            <IconBadge tone="successGlass" shrink>
              <CheckCircle2 size={18} className="text-brand-successStrong" />
            </IconBadge>
            <div className="min-w-0">
              <div className="ui-label text-brand-successStrong">{String(integration.meta?.page_name || "Página conectada")}</div>
              <div className="ui-meta truncate font-mono text-brand-successStrong">ID: {String(integration.meta?.ig_user_id || "")}</div>
            </div>
          </div>

          <MetaInsightsPanel integrationId={integration.id} />

          <Button variant="ghost" onClick={handleDisconnect} disabled={disconnecting} className="w-full" id="btn-ig-disconnect">
            {disconnecting ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
            {disconnecting ? "Desconectando" : "Desconectar Instagram"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <IconBadge size="xl">
            <Instagram size={28} className="text-brand-muted" />
          </IconBadge>
          <div>
            <div className="item-title">Nenhuma conta conectada</div>
            <div className="body-muted mt-1">Autorize via Meta para receber e enviar mensagens do Instagram</div>
          </div>
          <a href={`${API_URL}/api/integrations/instagram/auth`}>
            <Button id="btn-ig-connect"><ExternalLink size={17} />Conectar com Meta</Button>
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Painel Meta (custo/limite/qualidade) ─────────────────────────────────────

function MetaInsightsPanel({ integrationId }: { integrationId: number }) {
  const { data, error, isLoading, mutate, isValidating } = useSWR<MetaInsights>(
    `/api/integrations/${integrationId}/insights`,
    swrFetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  return (
    <div className="surface-soft rounded-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-brand-ink">
          <Gauge size={15} />
          <span className="ui-label">Painel Meta</span>
        </div>
        <button
          type="button"
          onClick={() => void mutate()}
          disabled={isValidating}
          className="focus-ring flex items-center gap-1 rounded-pill border border-brand-line px-2 py-1 text-[11px] font-bold text-brand-muted hover:bg-brand-canvas disabled:opacity-50"
        >
          <RefreshCw size={11} className={isValidating ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-brand-muted">
          <Loader2 size={15} className="animate-spin" /> Carregando dados da Meta…
        </div>
      ) : error ? (
        <p className="text-xs font-semibold text-brand-danger">
          {error instanceof Error ? error.message : "Não foi possível carregar os dados da Meta"}
        </p>
      ) : data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <MetaStat icon={Users} label="Seguidores" value={data.account.followers_count ?? "—"} />
          <MetaStat icon={Images} label="Publicações" value={data.account.media_count ?? "—"} />
          {data.api_usage ? (
            <>
              <MetaUsageBar label="Uso da API (chamadas)" pct={data.api_usage.call_count_pct} />
              <MetaUsageBar label="Uso da API (tempo de CPU)" pct={data.api_usage.total_cputime_pct} />
            </>
          ) : (
            <p className="body-muted sm:col-span-2">Sem dados de limite de uso disponíveis no momento.</p>
          )}
        </div>
      ) : null}

      <p className="mt-3 text-[11px] text-brand-muted">
        Custo por conversa e qualidade de número são conceitos da API Oficial do WhatsApp — passam a
        aparecer aqui quando essa integração for adicionada ao Kairos. Por enquanto o painel cobre a
        conta Instagram, que já usa a Meta Graph API de verdade.
      </p>
    </div>
  );
}

function MetaStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-card bg-brand-canvas p-3">
      <IconBadge size="sm">
        <Icon size={14} />
      </IconBadge>
      <div className="min-w-0">
        <div className="ui-meta">{label}</div>
        <div className="item-title">{value}</div>
      </div>
    </div>
  );
}

function MetaUsageBar({ label, pct }: { label: string; pct: number | null }) {
  const value = typeof pct === "number" ? Math.min(100, Math.max(0, pct)) : 0;
  const warn = value >= 80;
  return (
    <div className="rounded-card bg-brand-canvas p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="ui-meta">{label}</span>
        <span className={cn("text-xs font-bold", warn ? "text-brand-danger" : "text-brand-ink")}>
          {typeof pct === "number" ? `${pct}%` : "—"}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-line">
        <div
          className={cn("h-full transition-all", warn ? "bg-brand-danger" : "bg-brand-red")}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// ─── Section: Perfil ──────────────────────────────────────────────────────────

function PerfilSection({ user, onSaved, onLogout }: { user: UserData | undefined; onSaved: () => void; onLogout: () => void }) {
  const [name, setName] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [infoMsg, setInfoMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  async function handleSaveInfo(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setInfoMsg("");
    try {
      await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name: name || user?.name, email: email || user?.email }),
      });
      onSaved();
      setInfoMsg("Salvo com sucesso.");
    } catch (err: unknown) {
      setInfoMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally { setSaving(false); }
  }

  async function handleSavePassword(e: FormEvent) {
    e.preventDefault();
    setSavingPw(true); setPwMsg("");
    try {
      await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ current_password: currentPassword, password: newPassword }),
      });
      setCurrentPassword(""); setNewPassword("");
      setPwMsg("Senha atualizada com sucesso.");
    } catch (err: unknown) {
      setPwMsg(err instanceof Error ? err.message : "Erro ao atualizar senha.");
    } finally { setSavingPw(false); }
  }

  return (
    <div className="space-y-4">
      <section className="surface-card rounded-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <IconBadge size="lg" tone="charcoal" shrink className="text-sm font-black">
              {user?.name?.[0]?.toUpperCase() || "K"}
            </IconBadge>
            <div className="min-w-0">
              <p className="eyebrow mb-1">Conta</p>
              <h2 className="card-title truncate">{user?.name || "Operador"}</h2>
              <p className="body-muted truncate">{user?.email || "Sem e-mail carregado"}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onLogout}
            className="w-full border-brand-danger/30 text-brand-danger hover:bg-brand-dangerSoft sm:w-auto"
          >
            <LogOut size={16} />
            Sair da conta
          </Button>
        </div>
      </section>

      <form onSubmit={handleSaveInfo} className="surface-card rounded-panel p-4 sm:p-5">
        <h2 className="card-title mb-4">Informações pessoais</h2>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={name ?? user?.name ?? ""} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input type="email" value={email ?? user?.email ?? ""} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
          </div>
          {infoMsg && (
            <p className={`text-xs font-semibold ${infoMsg.includes("sucesso") ? "text-brand-successStrong" : "text-brand-danger"}`}>{infoMsg}</p>
          )}
          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={saving} id="btn-save-profile">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? "Salvando" : "Salvar"}
            </Button>
          </div>
        </div>
      </form>

      <form onSubmit={handleSavePassword} className="surface-card rounded-panel p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound size={16} className="text-brand-muted" />
          <h2 className="card-title">Alterar senha</h2>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Senha atual</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="space-y-1">
            <Label>Nova senha</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
          </div>
          {pwMsg && (
            <p className={`text-xs font-semibold ${pwMsg.includes("sucesso") ? "text-brand-successStrong" : "text-brand-danger"}`}>{pwMsg}</p>
          )}
          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={savingPw || !currentPassword || !newPassword} id="btn-save-password">
              {savingPw ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
              {savingPw ? "Atualizando" : "Atualizar senha"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Section: Workspace ───────────────────────────────────────────────────────

function WorkspaceSection({ workspace, onSaved }: { workspace: Workspace | undefined; onSaved: () => void }) {
  const [name, setName] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg("");
    try {
      await apiFetch("/api/settings/workspace", {
        method: "PATCH",
        body: JSON.stringify({ name: name || workspace?.name }),
      });
      onSaved();
      setMsg("Salvo com sucesso.");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSave} className="surface-card rounded-panel p-4 sm:p-5">
      <h2 className="card-title mb-4">Workspace</h2>
      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Nome do Workspace</Label>
          <Input value={name ?? workspace?.name ?? ""} onChange={(e) => setName(e.target.value)} placeholder="Nome do workspace" />
        </div>

        {workspace && (
          <div className="grid grid-cols-2 gap-3 rounded-card bg-brand-canvas p-3">
            <div>
              <div className="ui-label">Plano</div>
              <div className="item-title mt-0.5 capitalize">{workspace.plan}</div>
            </div>
            <div>
              <div className="ui-label">Membro desde</div>
              <div className="item-title mt-0.5">
                {new Date(workspace.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
          </div>
        )}

        {msg && (
          <p className={`text-xs font-semibold ${msg.includes("sucesso") ? "text-brand-successStrong" : "text-brand-danger"}`}>{msg}</p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} id="btn-save-workspace">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? "Salvando" : "Salvar"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ─── Section: Canais ──────────────────────────────────────────────────────────

function CanaisSection({
  integrations, onWaChanged, onIgDisconnected,
}: {
  integrations: Integration[];
  onWaChanged: () => void;
  onIgDisconnected: () => void;
}) {
  const whatsappConnections = integrations.filter((i) => i.channel === "whatsapp");
  const instagram = integrations.find((i) => i.channel === "instagram");

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="heading-md">WhatsApp</h2>
          <span className="ui-meta">
            {whatsappConnections.length} {whatsappConnections.length === 1 ? "número" : "números"}
          </span>
        </div>
        <div className="space-y-3">
          {whatsappConnections.map((integration) => (
            <WhatsAppConnectionCard key={integration.id} integration={integration} onChanged={onWaChanged} />
          ))}
          <WhatsAppAddCard onCreated={onWaChanged} />
        </div>
      </div>
      <InstagramSection integration={instagram} onDisconnect={onIgDisconnected} />
    </div>
  );
}

// ─── Section: Webhooks ────────────────────────────────────────────────────────

function WebhooksSection() {
  return (
    <div className="surface-card rounded-panel p-4 sm:p-5">
      <h2 className="card-title mb-4">Webhooks</h2>
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <IconBadge size="xs" tone="whatsapp">
              <Phone size={11} />
            </IconBadge>
            <span className="ui-label text-brand-ink">WhatsApp</span>
          </div>
          <p className="ui-meta break-all rounded-card bg-brand-canvas p-3 font-mono text-brand-ink text-[11px] sm:text-xs">
            {API_URL}/webhooks/whatsapp
          </p>
          <p className="ui-meta mt-1.5">Configurado automaticamente ao conectar via QR code.</p>
        </div>
        <div className="border-t border-brand-line pt-5">
          <div className="mb-2 flex items-center gap-1.5">
            <IconBadge size="xs" tone="instagram">
              <Instagram size={11} />
            </IconBadge>
            <span className="ui-label text-brand-ink">Instagram</span>
          </div>
          <p className="ui-meta break-all rounded-card bg-brand-canvas p-3 font-mono text-brand-ink text-[11px] sm:text-xs">
            {API_URL}/webhooks/instagram
          </p>
          <p className="ui-meta mt-1.5">Configure no Facebook Developers junto com o verify token do backend.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { logout } = useAuth(true);

  const { data: meData, mutate: mutateMe } = useSWR<{ user: UserData }>("/auth/me", swrFetcher);
  const { data: workspace, mutate: mutateWorkspace } = useSWR<Workspace>("/api/settings/workspace", swrFetcher);
  const { data: integrations = [], mutate: mutateIntegrations } = useSWR<Integration[]>("/api/integrations", swrFetcher);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader eyebrow="Configurações" title="Configurações" />

      <Tabs defaultValue="perfil" className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* Sidebar desktop */}
        <aside className="hidden w-52 shrink-0 flex-col border-r border-brand-line bg-brand-white/60 p-4 md:flex">
          <TabsList className="flex-col items-stretch gap-0.5 bg-transparent p-0 h-auto">
            {NAV_ITEMS.map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="justify-start gap-2.5 rounded-card px-3 py-2.5 text-sm data-[state=active]:bg-brand-red50 data-[state=active]:text-brand-red data-[state=active]:shadow-none"
              >
                {item.icon}
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </aside>

        {/* Mobile tab strip */}
        <div className="shrink-0 border-b border-brand-line bg-brand-white md:hidden">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none bg-transparent px-4 py-0">
            {NAV_ITEMS.map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="shrink-0 gap-1.5 rounded-none border-b-2 border-transparent px-3 pb-3 pt-3 text-xs data-[state=active]:border-brand-red data-[state=active]:bg-transparent data-[state=active]:text-brand-red data-[state=active]:shadow-none"
              >
                {item.icon}
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-2xl p-4 sm:p-6">
            <TabsContent value="perfil" className="mt-0">
              <PerfilSection user={meData?.user} onSaved={() => mutateMe()} onLogout={logout} />
            </TabsContent>
            <TabsContent value="workspace" className="mt-0">
              <WorkspaceSection workspace={workspace} onSaved={() => mutateWorkspace()} />
            </TabsContent>
            <TabsContent value="canais" className="mt-0">
              <CanaisSection
                integrations={integrations}
                onWaChanged={() => mutateIntegrations()}
                onIgDisconnected={() => mutateIntegrations()}
              />
            </TabsContent>
            <TabsContent value="webhooks" className="mt-0">
              <WebhooksSection />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
