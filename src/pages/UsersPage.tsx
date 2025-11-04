import { useEffect, useState } from "react";
import { Users, UserPlus, Trash2, Mail, Building2, Shield, Search } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company?: {
    id: string;
    name: string;
    cnpj: string;
  };
  createdAt: string;
}

interface Company {
  id: string;
  code: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
}

export function UsersPage() {
  const user = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "ADMIN_COMPANY",
    companyId: "",
  });

  useEffect(() => {
    loadUsers();
    loadCompanies();
  }, []);

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        console.error("Erro ao carregar usuários:", response.status);
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/companies`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCompanies(data.companies || data);
      } else {
        console.error("Erro ao carregar empresas:", response.status);
      }
    } catch (error) {
      console.error("Erro ao carregar empresas:", error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert("Usuário criado com sucesso!");
        setShowCreateModal(false);
        setFormData({
          name: "",
          email: "",
          password: "",
          role: "ADMIN_COMPANY",
          companyId: "",
        });
        loadUsers();
      } else {
        const error = await response.json();
        alert(`Erro: ${error.message}`);
      }
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      alert("Erro ao criar usuário");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja deletar este usuário?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert("Usuário deletado com sucesso!");
        loadUsers();
      } else {
        alert("Erro ao deletar usuário");
      }
    } catch (error) {
      console.error("Erro ao deletar usuário:", error);
      alert("Erro ao deletar usuário");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.company?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (user?.role !== "ADMIN_GLOBAL") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-500">Acesso negado. Apenas Admin Global.</p>
      </div>
    );
  }

  return (
    <section className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Gerenciamento de Usuários</h1>
            <p className="text-sm text-slate-500">Criar, visualizar e gerenciar usuários do sistema</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          <UserPlus className="h-4 w-4" />
          Criar Usuário
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-elevated">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
            />
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-slate-500">Carregando usuários...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="py-8 text-center text-slate-500">Nenhum usuário encontrado</p>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-4 transition hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{u.name}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {u.email}
                      </span>
                      {u.company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {u.company.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      u.role === "ADMIN_GLOBAL"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {u.role === "ADMIN_GLOBAL" ? "Admin Global" : "Admin Empresa"}
                  </span>
                  {u.id !== user.id && (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                      title="Deletar usuário"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-slate-800">Criar Novo Usuário</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nome</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                >
                  <option value="ADMIN_COMPANY">Admin Empresa</option>
                  <option value="ADMIN_GLOBAL">Admin Global</option>
                </select>
              </div>
              {formData.role === "ADMIN_COMPANY" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Empresa</label>
                  <select
                    required
                    value={formData.companyId}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                  >
                    <option value="">Selecione uma empresa</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nomeFantasia} - {c.cnpj}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
                >
                  Criar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
