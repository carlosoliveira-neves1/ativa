import { useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_CLOUD_API_URL ?? "http://localhost:4000";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao solicitar recuperação");
      }

      setMessage(data.message);
      setEmail("");
    } catch (err) {
      console.error("Erro ao solicitar recuperação:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao solicitar recuperação de senha.";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-accent/10 px-4 py-10">
      <div className="w-full max-w-[420px] space-y-8 rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-2xl backdrop-blur">
        <header className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-primary">
            NR-1 Compliance
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Recuperar senha</h1>
          <p className="text-sm text-slate-500">
            Digite seu e-mail para receber instruções de recuperação.
          </p>
        </header>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
              autoComplete="email"
            />
          </div>

          {isSubmitting ? (
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white opacity-70"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
              Enviando...
            </button>
          ) : (
            <button
              type="submit"
              className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Enviar instruções
            </button>
          )}

          {message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </form>

        <div className="border-t border-slate-200 pt-6 text-center">
          <Link
            to="/login"
            className="text-sm font-semibold text-primary hover:underline"
          >
            ← Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
