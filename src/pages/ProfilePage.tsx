import { useState } from "react";
import { User, Mail, Building2, Shield, Lock, Save } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: "error", text: "As senhas não coincidem" });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: "error", text: "A senha deve ter no mínimo 6 caracteres" });
      return;
    }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Senha alterada com sucesso!" });
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setIsEditingPassword(false);
      } else {
        const error = await response.json();
        setMessage({ type: "error", text: error.message || "Erro ao alterar senha" });
      }
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      setMessage({ type: "error", text: "Erro ao alterar senha" });
    }
  };

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-500">Carregando...</p>
      </div>
    );
  }

  return (
    <section className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Meu Perfil</h1>
          <p className="text-sm text-slate-500">Visualize e gerencie suas informações</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Informações do Usuário */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-elevated">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Informações Pessoais</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <User className="mt-0.5 h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-500">Nome</p>
                <p className="mt-1 font-semibold text-slate-800">{user.name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <Mail className="mt-0.5 h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-500">Email</p>
                <p className="mt-1 font-semibold text-slate-800">{user.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <Shield className="mt-0.5 h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-500">Tipo de Acesso</p>
                <p className="mt-1">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      user.role === "ADMIN_GLOBAL"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {user.role === "ADMIN_GLOBAL" ? "Administrador Global" : "Administrador da Empresa"}
                  </span>
                </p>
              </div>
            </div>

            {user.company && (
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                <Building2 className="mt-0.5 h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500">Empresa</p>
                  <p className="mt-1 font-semibold text-slate-800">{user.company.nomeFantasia}</p>
                  <p className="mt-0.5 text-xs text-slate-500">CNPJ: {user.company.cnpj}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Alterar Senha */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-elevated">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Segurança</h2>
            {!isEditingPassword && (
              <button
                onClick={() => setIsEditingPassword(true)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-dark"
              >
                <Lock className="h-4 w-4" />
                Alterar Senha
              </button>
            )}
          </div>

          {message && (
            <div
              className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                message.type === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          {isEditingPassword ? (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Senha Atual</label>
                <input
                  type="password"
                  required
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, currentPassword: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nova Senha</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                />
                <p className="mt-1 text-xs text-slate-500">Mínimo de 6 caracteres</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingPassword(false);
                    setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                    setMessage(null);
                  }}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
                >
                  <Save className="h-4 w-4" />
                  Salvar Senha
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <Lock className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-500">Senha protegida</p>
              <p className="mt-1 text-xs text-slate-400">
                Clique em "Alterar Senha" para modificar sua senha de acesso
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
