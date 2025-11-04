import { Link } from "react-router-dom";

export function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-accent/10 px-4 py-10">
      <div className="w-full max-w-[420px] space-y-8 rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-2xl backdrop-blur">
        <header className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-primary">
            NR-1 Compliance
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Recuperar senha</h1>
          <p className="text-sm text-slate-500">
            Entre em contato com o administrador da sua empresa para redefinir sua senha.
          </p>
        </header>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 space-y-2">
          <p className="text-sm font-semibold text-blue-800">
            Como recuperar sua senha:
          </p>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Entre em contato com o administrador da sua empresa</li>
            <li>Solicite a redefinição da sua senha</li>
            <li>O administrador poderá criar uma nova senha para você</li>
          </ul>
        </div>

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
