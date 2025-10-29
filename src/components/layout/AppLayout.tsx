import { Fragment } from "react";
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
} from "lucide-react";
import { useQuestionnaireStore } from "../../store/useQuestionnaireStore";
import { useScoreSnapshot } from "../../hooks/useScoreSnapshot";

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Questionários", to: "/questionarios", icon: ClipboardCheck },
  { label: "Relatórios", to: "/relatorios", icon: FileBarChart },
  { label: "Planos de Ação", to: "/planos", icon: ShieldPlus },
];

export function AppLayout() {
  const location = useLocation();
  const snapshot = useScoreSnapshot();
  const registerSync = useQuestionnaireStore((state) => state.registerSync);

  const handleSync = () => {
    registerSync({
      timestamp: new Date().toISOString(),
      conformity: snapshot.overallConformity,
      completion: snapshot.overallCompletion,
      note: "Sincronização manual",
    });
  };

  return (
    <div className="flex min-h-screen bg-surface text-slate-900">
      <aside className="hidden w-72 flex-col justify-between border-r border-slate-200 bg-white px-6 py-8 shadow-lg lg:flex">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-2xl font-semibold text-accent">
              +
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-primary">
                NR-1 Compliance
              </p>
              <h1 className="text-xl font-semibold text-slate-900">Ativa</h1>
            </div>
          </div>

          <nav className="space-y-1">
            {navigation.map((item) => {
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

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 px-4 py-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <Menu className="h-6 w-6 text-primary" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.45em] text-primary">
                  NR-1 Compliance
                </p>
                <h1 className="text-lg font-semibold text-slate-900">Ativa</h1>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-between gap-4 lg:justify-end">
              <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 sm:flex">
                <span className="font-semibold text-primary">{snapshot.riskLevel}</span>
                <span className="text-slate-400">•</span>
                <span>{snapshot.pendingQuestions.length} pendências</span>
              </div>
              <button
                type="button"
                onClick={handleSync}
                className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
              >
                <RefreshCw className="h-4 w-4" />
                Registrar sincronização
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 bg-surface px-4 py-8 lg:px-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
