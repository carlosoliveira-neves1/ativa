import { useState } from "react";
import {
  DownloadCloud,
  FileBarChart2,
  FilePieChart,
  FileStack,
  Filter,
  MailQuestion,
} from "lucide-react";
import { useScoreSnapshot } from "../hooks/useScoreSnapshot";
import { useAuthStore } from "../store/useAuthStore";
import { useNotifications } from "../hooks/useNotifications";

const API_BASE = import.meta.env.VITE_CLOUD_API_URL ?? "http://localhost:4000";

const reportCards = [
  {
    title: "Relatório Geral de Conformidade",
    description: "Resumo do nível de atendimento da empresa às normas.",
    keyMetrics: ["Conformidade média", "Questionários ativos"],
    accent: "bg-emerald-100 text-emerald-700",
  },
  {
    title: "Relatório de Pendências",
    description: "Lista de itens não conformes, responsáveis e prazos.",
    keyMetrics: ["Pendências abertas", "Ações atrasadas"],
    accent: "bg-amber-100 text-amber-700",
  },
  {
    title: "Relatório por Unidade/Setor",
    description: "Comparativo entre unidades e setores da empresa.",
    keyMetrics: ["Unidades avaliadas", "Planos ativos"],
    accent: "bg-primary/10 text-primary",
  },
  {
    title: "Relatório de Evolução",
    description: "Antes e depois da implementação de planos de ação.",
    keyMetrics: ["Taxa de conclusão", "Sincronizações"],
    accent: "bg-accent/20 text-accent",
  },
];

export function ReportsPage() {
  const snapshot = useScoreSnapshot();
  const { addNotification } = useNotifications();
  const { token, selectedCompanyId, user } = useAuthStore((state) => ({
    token: state.token,
    selectedCompanyId: state.selectedCompanyId,
    user: state.user,
  }));
  const [exportingZip, setExportingZip] = useState(false);

  const totalPendencias = snapshot.pendingQuestions.length;
  const totalPlanos = Math.max(totalPendencias, Math.round(snapshot.overallCompletion / 10));

  const notify = (message: string, type: Parameters<typeof addNotification>[0]["type"]) => {
    addNotification({ type, message });
  };

  const extractFilename = (disposition: string | null): string | null => {
    if (!disposition) return null;
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    return filenameMatch ? filenameMatch[1] : null;
  };

  const handleExportZip = async () => {
    if (!token) {
      notify("Sessão expirada. Faça login novamente.", "error");
      return;
    }

    if (user?.role === "ADMIN_GLOBAL" && !selectedCompanyId) {
      notify("Selecione uma empresa para exportar os relatórios.", "error");
      return;
    }

    setExportingZip(true);
    try {
      const headers = new Headers();
      headers.set("Authorization", `Bearer ${token}`);
      if (user?.role === "ADMIN_GLOBAL" && selectedCompanyId) {
        headers.set("x-company-id", selectedCompanyId);
      }

      const response = await fetch(`${API_BASE}/reports/export/all.zip`, { headers });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message =
          data && typeof data === "object" && "message" in data && typeof data.message === "string"
            ? data.message
            : "Erro ao exportar relatórios.";
        throw new Error(message);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition");
      const filename = extractFilename(disposition) ?? `relatorios-${new Date().toISOString().slice(0, 10)}.zip`;

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      notify("Pacote de relatórios exportado com sucesso!", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao exportar relatórios.";
      notify(message, "error");
    } finally {
      setExportingZip(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          <FileBarChart2 className="h-4 w-4" />
          Central de Relatórios
        </span>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Relatórios de Conformidade</h1>
            <p className="text-sm text-slate-500">
              Gere relatórios detalhados sobre conformidade, pendências e evolução dos planos de ação.
              Acompanhe as evidências exigidas pela NR-1 em ciclos curtos.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm lg:flex-row lg:items-center">
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-600 shadow-sm transition hover:border-primary hover:text-primary">
              <Filter className="h-4 w-4" />
              Filtros avançados
            </button>
            <button
              type="button"
              onClick={handleExportZip}
              disabled={exportingZip}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-semibold text-white shadow-elevated transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-primary/60"
            >
              <DownloadCloud className="h-4 w-4" />
              {exportingZip ? "Gerando pacote..." : "Exportar todos (ZIP)"}
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {reportCards.map((card) => (
          <div key={card.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${card.accent}`}>
                  {card.title.split(" ")[0]}
                </p>
                <h2 className="mt-3 text-xl font-semibold text-slate-900">{card.title}</h2>
                <p className="mt-2 text-sm text-slate-500">{card.description}</p>
              </div>
              <span className="h-10 w-10 rounded-full bg-slate-100 text-slate-400">
                <MailQuestion className="h-full w-full p-2" />
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-xs text-slate-600">
              {card.keyMetrics.map((metric) => (
                <div key={metric} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <span>{metric}</span>
                  <span className="font-semibold text-primary">
                    {metric.includes("Conformidade")
                      ? `${snapshot.overallConformity}%`
                      : metric.includes("Pendências")
                      ? totalPendencias
                      : metric.includes("Planos")
                      ? totalPlanos
                      : metric.includes("Sincronizações")
                      ? snapshot.syncHistory.length
                      : snapshot.sections.length}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-elevated">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Exportação rápida</h2>
            <p className="text-sm text-slate-500">
              Exporte relatórios filtrados por período, unidade e status dos planos.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-200">
              <FilePieChart className="h-4 w-4" />
              Relatório de Conformidade (CSV)
            </button>
            <button className="inline-flex items-center justify-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20">
              <FileStack className="h-4 w-4" />
              Planos de Ação (CSV)
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 text-sm text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Período: Últimos 90 dias
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Unidades: Todas
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Status: Pendentes + Em andamento
            </span>
          </div>
          <p>
            Use filtros para segmentar auditorias pontuais, comparar períodos de ações corretivas e gerar
            relatórios para inspeções externas com as evidências anexadas.
          </p>
        </div>
      </div>
    </section>
  );
}
