"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, Mail, Lock, User, Building2, Phone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthPanel } from "@/components/layout/AuthPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function RegisterPage() {
  const { register } = useAuth(false);
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password, workspaceName, phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPanel title="Crie seu workspace" subtitle="Cadastro gratuito">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-brand-ink" htmlFor="name">
              Nome completo
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
              <Input
                id="name"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-brand-ink" htmlFor="workspaceName">
              Nome do workspace
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
              <Input
                id="workspaceName"
                placeholder="Sua empresa"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-brand-ink" htmlFor="phone">
            Telefone
          </label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <Input
              id="phone"
              type="tel"
              placeholder="+55 (11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-brand-ink" htmlFor="email">
            E-mail
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-brand-ink" htmlFor="password">
              Senha
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Mín. 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 pr-10"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted transition hover:text-brand-ink"
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-brand-ink" htmlFor="confirmPassword">
              Confirmar senha
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-9 pr-10"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted transition hover:text-brand-ink"
                tabIndex={-1}
                aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-card border border-brand-red200 bg-brand-red50 px-3 py-2.5 text-sm font-semibold text-brand-red">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Criando workspace..." : "Criar workspace"}
        </Button>
      </form>

      <p className="mt-5 text-sm text-brand-muted">
        Já tem conta?{" "}
        <Link className="font-bold text-brand-red underline" href="/login">
          Entrar
        </Link>
      </p>
    </AuthPanel>
  );
}
