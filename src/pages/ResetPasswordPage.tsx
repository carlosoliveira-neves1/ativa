import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_CLOUD_API_URL ?? "http://localhost:4000";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Token inválido ou ausente");
    }
  }, [token]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    if (newPassword.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao redefinir senha");
      }

      setSuccess(true);
      
      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      console.error("Erro ao redefinir senha:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao redefinir senha.";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-accent/10 px-4 py-10">
        <div className="w-full max-w-[420px] space-y-8 rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-2xl backdrop-blur">
          <header className="space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-primary">
              NR-1 Compliance
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">Link inválido</h1>
          </header>

          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            O link de recuperação é inválido ou está ausente.
          </div>

          <div className="border-t border-slate-200 pt-6 text-center">
            <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
              Solicitar nova recuperação
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-accent/10 px-4 py-10">
        <div className="w-full max-w-[420px] space-y-8 rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-2xl backdrop-blur">
          <header className="space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-primary">
              NR-1 Compliance
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">Senha redefinida!</h1>
          </header>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-2">
            <p className="text-sm font-semibold text-emerald-800">
              ✅ Senha redefinida com sucesso!
            </p>
            <p className="text-sm text-emerald-700">
              Você será redirecionado para a página de login em instantes...
            </p>
          </div>

          <div className="border-t border-slate-200 pt-6 text-center">
            <Link to="/login" className="text-sm font-semibold text-primary hover:underline">
              Ir para o login agora
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-accent/10 px-4 py-10">
      <div className="w-full max-w-[420px] space-y-8 rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-2xl backdrop-blur">
        <header className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-primary">
            NR-1 Compliance
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Nova senha</h1>
          <p className="text-sm text-slate-500">
            Digite sua nova senha abaixo.
          </p>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="newPassword" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nova Senha *
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={8}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold uppercase tracking-wide text-primary/70"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <p className="text-xs text-slate-400">Mínimo de 8 caracteres</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Confirmar Senha *
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={8}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
              autoComplete="new-password"
            />
          </div>

          {isSubmitting ? (
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white opacity-70"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
              Redefinindo...
            </button>
          ) : (
            <button
              type="submit"
              className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Redefinir senha
            </button>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </form>

        <div className="border-t border-slate-200 pt-6 text-center">
          <Link to="/login" className="text-sm font-semibold text-primary hover:underline">
            ← Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
