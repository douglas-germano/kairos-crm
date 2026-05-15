"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthPanel } from "@/components/layout/AuthPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
        <Input placeholder="Nome do operador" value={name} onChange={(event) => setName(event.target.value)} required />
        <Input type="email" placeholder="email@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Input type="password" placeholder="Senha" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
        {error ? <p className="rounded-tight border border-brand-red px-3 py-2 text-sm font-semibold text-brand-red">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Criando..." : "Criar workspace"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-brand-grey">
        Ja tem conta?{" "}
        <Link className="font-bold text-brand-red underline" href="/login">
          Entrar
        </Link>
      </p>
    </AuthPanel>
  );
}
