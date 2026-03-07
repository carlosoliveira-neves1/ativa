import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signup, type SignupPayload } from "../services/authClient";
import { useAuthStore } from "../store/useAuthStore";
import { resetQuestionnaireState } from "../store/useQuestionnaireStore";

export function SignupPage() {
  const navigate = useNavigate();
  const { setSession, setError, setStatus, clearSession } = useAuthStore();

  const [form, setForm] = useState<SignupPayload>({
    cnpj: "",
    email: "",
    login: "",
    password: "",
    nomeFantasia: "",
    razaoSocial: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setLocalError] = useState<string | null>(null);
  const [companyCode, setCompanyCode] = useState<string | null>(null);

  const handleChange = (field: keyof SignupPayload) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const formatCNPJ = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 14) {
      return digits
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return value;
  };

  const handleCNPJChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(event.target.value);
    setForm((prev) => ({ ...prev, cnpj: formatted }));
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    // Validar campos obrigatórios
    if (!form.cnpj || !form.nomeFantasia || !form.razaoSocial || !form.login || !form.email || !form.password) {
      setLocalError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    
    // Validar CNPJ (deve ter 14 dígitos)
    const cnpjDigits = form.cnpj.replace(/\D/g, "");
    if (cnpjDigits.length !== 14) {
      setLocalError("CNPJ inválido. Deve conter 14 dígitos.");
      return;
    }
    
    // Validar senha (mínimo 6 caracteres)
    if (form.password.length < 6) {
      setLocalError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    
    setIsSubmitting(true);
    setStatus("loading");
    setLocalError(null);
    setCompanyCode(null);

    try {
      const response = await signup(form);
      setSession(response.token, response.user, response.user.company?.id ?? null);
      setCompanyCode(response.companyCode);
      resetQuestionnaireState();
      
      // Mostrar código por 3 segundos antes de redirecionar
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 3000);
    } catch (err) {
      console.error("Cadastro falhou", err);
      let message = "Não foi possível realizar o cadastro.";
      
      if (err instanceof Error) {
        // Melhorar mensagens de erro específicas
        if (err.message.includes("já existe") || err.message.includes("already exists")) {
          message = "Este CNPJ ou email já está cadastrado no sistema.";
        } else if (err.message.includes("400")) {
          message = "Dados inválidos. Verifique as informações e tente novamente.";
        } else if (err.message.includes("email")) {
          message = "Email inválido. Verifique o formato do email.";
        } else {
          message = err.message;
        }
      }
      
      setLocalError(message);
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
      <div className="w-full max-w-[520px] space-y-8 rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-2xl backdrop-blur">
        <header className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-primary">
            NR-1 Compliance
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Criar conta</h1>
          <p className="text-sm text-slate-500">
            Cadastre sua empresa e comece a usar a plataforma.
          </p>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="cnpj" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              CNPJ *
            </label>
            <input
              id="cnpj"
              value={form.cnpj}
              onChange={handleCNPJChange}
              required
              placeholder="00.000.000/0000-00"
              maxLength={18}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="nomeFantasia" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nome Fantasia
            </label>
            <input
              id="nomeFantasia"
              value={form.nomeFantasia}
              onChange={handleChange("nomeFantasia")}
              placeholder="Nome da sua empresa"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="razaoSocial" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Razão Social
            </label>
            <input
              id="razaoSocial"
              value={form.razaoSocial}
              onChange={handleChange("razaoSocial")}
              placeholder="Razão social da empresa"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              E-mail *
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={handleChange("email")}
              required
              placeholder="seu@email.com"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="login" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Login *
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
              Senha *
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange("password")}
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

          {isSubmitting ? (
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white opacity-70"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
              Criando conta...
            </button>
          ) : (
            <button
              type="submit"
              className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Criar conta
            </button>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {companyCode && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-2">
              <p className="text-sm font-semibold text-emerald-800">
                Cadastro realizado com sucesso!
              </p>
              <p className="text-sm text-emerald-700">
                Seu código de empresa é: <span className="font-bold">{companyCode}</span>
              </p>
              <p className="text-xs text-emerald-600">
                Guarde este código para futuros acessos. Redirecionando...
              </p>
            </div>
          )}
        </form>

        <div className="border-t border-slate-200 pt-6 text-center">
          <p className="text-sm text-slate-600">
            Já tem uma conta?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
