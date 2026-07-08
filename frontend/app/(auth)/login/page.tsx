"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthPanel } from "@/components/layout/AuthPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { login } = useAuth(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPanel title="Entrar no workspace" subtitle="Acesso seguro">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email">E-mail</Label>
          <Input id="login-email" type="email" placeholder="email@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="login-password">Senha</Label>
          <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        {error ? <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-brand-danger">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-brand-muted">
        Ainda nao tem conta?{" "}
        <Link className="font-bold text-brand-red underline" href="/register">
          Criar workspace
        </Link>
      </p>
    </AuthPanel>
  );
}
