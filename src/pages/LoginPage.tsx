import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { login, type LoginPayload } from "../services/authClient";
import { fetchCloudState } from "../services/cloudClient";
import { useAuthStore } from "../store/useAuthStore";
import { resetQuestionnaireState, useQuestionnaireStore } from "../store/useQuestionnaireStore";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";

  const {
    token,
    status,
    error,
    setStatus,
    setError,
    setSession,
    clearSession,
    selectedCompanyId,
  } = useAuthStore((state) => ({
    token: state.token,
    status: state.status,
    error: state.error,
    setStatus: state.setStatus,
    setError: state.setError,
    setSession: state.setSession,
    clearSession: state.clearSession,
    selectedCompanyId: state.selectedCompanyId,
  }));

  const hydrate = useQuestionnaireStore((state) => state.hydrate);

  const [form, setForm] = useState<LoginPayload>({
    companyCode: "",
    login: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (token && status === "authenticated") {
      navigate(from, { replace: true });
    }
  }, [token, status, navigate, from]);

  const handleChange = (field: keyof LoginPayload) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    // Validar campos obrigatórios
    if (!form.login || !form.password) {
      setError("Por favor, preencha login e senha.");
      return;
    }
    
    setIsSubmitting(true);
    setStatus("loading");
    setError(null);
    try {
      const response = await login(form);
      const companyId = response.user.company?.id ?? null;
      setSession(response.token, response.user, companyId);
      resetQuestionnaireState();
      try {
        const cloudState = await fetchCloudState();
        hydrate(cloudState);
      } catch (syncError) {
        console.warn("Falha ao sincronizar estado inicial", syncError);
        resetQuestionnaireState();
      }

      navigate(from, { replace: true });
    } catch (err) {
      console.error("Login falhou", err);
      let message = "Não foi possível autenticar.";
      
      if (err instanceof Error) {
        // Melhorar mensagens de erro específicas
        if (err.message.includes("401") || err.message.includes("Unauthorized")) {
          message = "Login ou senha incorretos. Verifique suas credenciais.";
        } else if (err.message.includes("404") || err.message.includes("não encontrad")) {
          message = "Código da empresa não encontrado. Verifique o código ATV-XXXX.";
        } else if (err.message.includes("400")) {
          message = "Dados inválidos. Verifique as informações e tente novamente.";
        } else {
          message = err.message;
        }
      }
      
      setError(message);
      clearSession();
      resetQuestionnaireState();
    } finally {
      setIsSubmitting(false);
      setStatus("idle");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-accent/10 px-4 py-10">
      <div className="w-full max-w-[420px] space-y-8 rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-2xl backdrop-blur">
        <header className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-primary">
            NR-1 Compliance
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Acessar plataforma</h1>
          <p className="text-sm text-slate-500">
            Informe o código da empresa, seu login e senha para continuar.
          </p>
        </header>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="companyCode" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Código da empresa
            </label>
            <input
              id="companyCode"
              value={form.companyCode ?? ""}
              onChange={handleChange("companyCode")}
              placeholder="ATV-XXXX"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
              autoComplete="organization"
            />
            <p className="text-xs text-slate-400">
              Solicite ao administrador se ainda não tiver o código. Para administradores globais, preencher este campo é opcional.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="login" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Login
            </label>
            <input
              id="login"
              value={form.login}
              onChange={handleChange("login")}
              required
              placeholder="seunome"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange("password")}
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold uppercase tracking-wide text-primary/70"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          {status === "loading" || isSubmitting ? (
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white opacity-70"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
              Entrando...
            </button>
          ) : (
            <button
              type="submit"
              className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Entrar
            </button>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </form>

        <div className="space-y-3">
          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>

          <div className="border-t border-slate-200 pt-4 text-center hidden">
            <p className="text-sm text-slate-600">
              Não tem uma conta?{" "}
              <Link to="/signup" className="font-semibold text-primary hover:underline">
                Cadastre-se
              </Link>
            </p>
          </div>
        </div>

        {token && selectedCompanyId && status === "authenticated" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
            Sessão ativa. Você será redirecionado automaticamente.
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
