"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthPanel } from "@/components/layout/AuthPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const { register } = useAuth(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPanel title="Criar operacao" subtitle="Novo workspace">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reg-name">Nome do operador</Label>
          <Input id="reg-name" placeholder="Seu nome" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-email">E-mail</Label>
          <Input id="reg-email" type="email" placeholder="email@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-password">Senha</Label>
          <Input id="reg-password" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
        </div>
        {error ? <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-brand-danger">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Criando..." : "Criar workspace"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-brand-muted">
        Ja tem conta?{" "}
        <Link className="font-bold text-brand-red underline" href="/login">
          Entrar
        </Link>
      </p>
    </AuthPanel>
  );
}
