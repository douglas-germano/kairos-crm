"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthPanel } from "@/components/layout/AuthPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
        <Input type="email" placeholder="email@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Input type="password" placeholder="Senha" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error ? <p className="rounded-tight border border-brand-red px-3 py-2 text-sm font-semibold text-brand-red">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-brand-grey">
        Ainda nao tem conta?{" "}
        <Link className="font-bold text-brand-red underline" href="/register">
          Criar workspace
        </Link>
      </p>
    </AuthPanel>
  );
}
