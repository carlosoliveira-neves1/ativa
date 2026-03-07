import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  Menu,
  RefreshCw,
  ShieldPlus,
  Users,
  User,
  GraduationCap,
  X,
} from "lucide-react";
import { useQuestionnaireStore } from "../../store/useQuestionnaireStore";
import { useScoreSnapshot } from "../../hooks/useScoreSnapshot";
import { useAuthStore } from "../../store/useAuthStore";
import { listCompanies, type CompanySummary } from "../../services/authClient";
import { resetQuestionnaireState } from "../../store/useQuestionnaireStore";

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Questionários", to: "/questionarios", icon: ClipboardCheck },
  { label: "Relatórios", to: "/relatorios", icon: FileBarChart },
  { label: "Planos de Ação", to: "/planos", icon: ShieldPlus },
  { label: "Treinamentos", to: "/treinamentos", icon: GraduationCap },
  { label: "Usuários", to: "/usuarios", icon: Users, adminOnly: true },
  { label: "Perfil", to: "/perfil", icon: User },
];

export function AppLayout() {
  const location = useLocation();
  const snapshot = useScoreSnapshot();
  const registerSync = useQuestionnaireStore((state) => state.registerSync);
  const clearSession = useAuthStore((state) => state.clearSession);
  const user = useAuthStore((state) => state.user);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);
  const setSelectedCompanyId = useAuthStore((state) => state.setSelectedCompanyId);
  const token = useAuthStore((state) => state.token);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companyQuery, setCompanyQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const hasAutoSelectedCompany = useRef(false);

  useEffect(() => {
    if (!token || user?.role !== "ADMIN_GLOBAL") {
      setCompanies([]);
      return;
    }

    let cancelled = false;
    async function loadCompanies() {
      setCompaniesLoading(true);
      try {
        const response = await listCompanies(companyQuery || undefined);
        if (!cancelled) {
          setCompanies(response.companies);
        }
      } catch (error) {
        console.warn("Falha ao carregar empresas", error);
        if (!cancelled) {
          setCompanies([]);
        }
      } finally {
        if (!cancelled) {
          setCompaniesLoading(false);
        }
      }
    }

    loadCompanies();

    return () => {
      cancelled = true;
    };
  }, [token, user?.role, companyQuery]);

  useEffect(() => {
    if (user?.role !== "ADMIN_GLOBAL") {
      hasAutoSelectedCompany.current = false;
      return;
    }

    if (companiesLoading || companies.length === 0) {
      return;
    }

    const currentIsValid = selectedCompanyId
      ? companies.some((company) => company.id === selectedCompanyId)
      : false;

    if (!currentIsValid && !hasAutoSelectedCompany.current) {
      setSelectedCompanyId(companies[0].id);
      hasAutoSelectedCompany.current = true;
    }
  }, [user?.role, companiesLoading, companies, selectedCompanyId, setSelectedCompanyId]);

  const handleSync = () => {
    registerSync({
      timestamp: new Date().toISOString(),
      conformity: snapshot.overallConformity,
      completion: snapshot.overallCompletion,
      note: "Sincronização manual",
    });
  };

  const activeCompanyName = useMemo(() => {
    if (!user) {
      return "";
    }
    if (user.role === "ADMIN_GLOBAL") {
      const match = companies.find((company) => company.id === selectedCompanyId);
      return match?.nomeFantasia ?? "Selecionar empresa";
    }
    return user.company?.nomeFantasia ?? "";
  }, [user, companies, selectedCompanyId]);

  const handleLogout = () => {
    resetQuestionnaireState();
    clearSession();
  };

  return (
    <div className="flex min-h-screen bg-surface text-slate-900">
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-72 flex-col justify-between border-r border-slate-200 bg-white px-6 py-8 shadow-lg lg:flex">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-2xl font-semibold text-accent">
              +
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-primary">
                Análise Psicossocial FAP
              </p>
              <h1 className="text-xl font-semibold text-slate-900">Formulário NR1</h1>
            </div>
          </div>

          <nav className="space-y-1">
            {navigation.map((item) => {
              if (item.adminOnly && user?.role !== "ADMIN_GLOBAL") return null;
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      isActive
                        ? "bg-primary text-white shadow-elevated"
                        : "text-slate-600 hover:bg-slate-100"
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-700">Resumo rápido</p>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Conformidade</p>
              <p className="text-lg font-semibold text-primary">
                {snapshot.overallConformity}%
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Preenchimento</p>
              <p className="text-lg font-semibold text-accent">
                {snapshot.overallCompletion}%
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSync}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-elevated transition hover:bg-primary-dark"
          >
            <Activity className="h-4 w-4" />
            Sincronizar agora
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col justify-between border-r border-slate-200 bg-white px-6 py-8 shadow-2xl transition-transform duration-300 lg:hidden ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-2xl font-semibold text-accent">
                +
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.45em] text-primary">
                  Análise Psicossocial FAP
                </p>
                <h1 className="text-xl font-semibold text-slate-900">Formulário NR1</h1>
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="space-y-1">
            {navigation.map((item) => {
              if (item.adminOnly && user?.role !== "ADMIN_GLOBAL") return null;
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      isActive
                        ? "bg-primary text-white shadow-elevated"
                        : "text-slate-600 hover:bg-slate-100"
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-700">Resumo rápido</p>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Conformidade</p>
              <p className="text-lg font-semibold text-primary">
                {snapshot.overallConformity}%
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Preenchimento</p>
              <p className="text-lg font-semibold text-accent">
                {snapshot.overallCompletion}%
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSync}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-elevated transition hover:bg-primary-dark"
          >
            <Activity className="h-4 w-4" />
            Sincronizar agora
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 px-4 py-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-xl text-primary transition hover:bg-primary/10"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.45em] text-primary">
                  Análise Psicossocial FAP
                </p>
                <h1 className="text-lg font-semibold text-slate-900">Formulário NR1</h1>
              </div>
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-3 lg:gap-4">
              <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 2xl:flex">
                <span className="font-semibold text-primary">{snapshot.riskLevel}</span>
                <span className="text-slate-400">•</span>
                <span>{snapshot.pendingQuestions.length} pendências</span>
              </div>

              {user?.role === "ADMIN_GLOBAL" && (
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm">
                  <input
                    value={companyQuery}
                    onChange={(event) => setCompanyQuery(event.target.value)}
                    placeholder="Buscar empresa"
                    className="min-w-[140px] rounded-md border border-transparent px-2 py-1 text-xs text-slate-600 outline-none focus:border-primary"
                  />
                  <select
                    value={selectedCompanyId ?? ""}
                    onChange={(event) => {
                      const newCompanyId = event.target.value || null;
                      setSelectedCompanyId(newCompanyId);
                      // Sincronizar automaticamente ao trocar de empresa
                      if (newCompanyId) {
                        handleSync();
                      }
                    }}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-primary"
                  >
                    <option value="">Global</option>
                    {companiesLoading && <option value="" disabled>Carregando...</option>}
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.nomeFantasia}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm">
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-slate-700">{user?.name ?? ""}</span>
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">
                    {activeCompanyName || user?.company?.nomeFantasia || ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSync}
                  className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 py-2 text-[11px] font-semibold text-primary transition hover:bg-primary hover:text-white"
                >
                  <RefreshCw className="h-3 w-3" />
                  Sync
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 bg-surface px-4 py-6 sm:py-8 lg:px-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
