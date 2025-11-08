import { Fragment, useEffect, useMemo, useState } from "react";
import type { ChartOptions, TooltipItem } from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Activity,
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  ClipboardList,
  LineChart,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useScoreSnapshot } from "../hooks/useScoreSnapshot";
import { useAuthStore } from "../store/useAuthStore";
import { fetchInsights, generateInsights } from "../services/authClient";

const riskLabels: Record<string, { chip: string; description: string }> = {
  Baixo: {
    chip: "bg-emerald-100 text-emerald-700",
    description: "Ciclo saudável · Continue monitorando",
  },
  Moderado: {
    chip: "bg-amber-100 text-amber-700",
    description: "Reforçar evidências e planos corretivos",
  },
  Alto: {
    chip: "bg-red-100 text-red-700",
    description: "Atenção imediata · Priorize ações corretivas",
  },
};

export function DashboardPage() {
  const snapshot = useScoreSnapshot();
  const { user, selectedCompanyId } = useAuthStore((state) => ({
    user: state.user,
    selectedCompanyId: state.selectedCompanyId,
  }));

  const [focus, setFocus] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [insightCreatedAt, setInsightCreatedAt] = useState<string | null>(null);

  const companyId = user?.role === "ADMIN_GLOBAL" ? selectedCompanyId : user?.company?.id ?? null;

  // Limpar insights quando mudar de empresa
  useEffect(() => {
    setAiSuggestion(null);
    setInsightCreatedAt(null);
    setAiError(null);
    setFocus("");
  }, [companyId]);

  // Carregar insights automaticamente
  useEffect(() => {
    const loadInsights = async () => {
      if (!companyId) return;
      
      setAiLoading(true);
      setAiError(null);
      try {
        const response = await fetchInsights(companyId);
        if (response.suggestions) {
          setAiSuggestion(response.suggestions);
          setInsightCreatedAt(response.createdAt ?? null);
        }
      } catch (error) {
        console.error("Falha ao carregar insights", error);
        // Não exibir erro se não houver insights ainda
      } finally {
        setAiLoading(false);
      }
    };

    loadInsights();
  }, [companyId]);

  const renderRichText = (text: string) => {
    const segments = text.split(/(\*\*[^*]+\*\*)/).filter(Boolean);
    return segments.map((segment, index) => {
      if (segment.startsWith("**") && segment.endsWith("**")) {
        return (
          <span key={index} className="font-semibold text-slate-800">
            {segment.slice(2, -2)}
          </span>
        );
      }
      return <Fragment key={index}>{segment}</Fragment>;
    });
  };

  const suggestionParagraphs = useMemo(() => {
    if (!aiSuggestion) {
      return [];
    }

    // Processar o texto para melhor formatação
    const lines = aiSuggestion.split("\n").map((line) => line.trim()).filter(Boolean);
    const formatted: Array<
      {
        type: "title" | "text" | "list";
        content: string;
        meta?: { emoji: string; accent: string; textColor: string; number?: number };
        listPrefix?: string;
      }
    > = [];

    let sectionCounter = 0;
    let currentMeta: { emoji: string; accent: string; textColor: string; number?: number } | null = null;

    const defaultMeta = { emoji: "📌", accent: "bg-slate-100 border-l-4 border-slate-400", textColor: "text-slate-700" };

    const resolveMeta = (content: string): { emoji: string; accent: string; textColor: string } => {
      if (/imediat|urgente|crítico|alta prioridade/i.test(content)) {
        return { emoji: "🚨", accent: "bg-red-50 border-l-4 border-red-500", textColor: "text-red-800" };
      }
      if (/reforç|melhoria|ajuste|otimiz/i.test(content)) {
        return { emoji: "⚙️", accent: "bg-amber-50 border-l-4 border-amber-500", textColor: "text-amber-800" };
      }
      if (/estratégic|iniciativa|visão|planejamento/i.test(content)) {
        return { emoji: "🎯", accent: "bg-blue-50 border-l-4 border-blue-500", textColor: "text-blue-800" };
      }
      if (/positivo|sucesso|forte|excelente/i.test(content)) {
        return { emoji: "✅", accent: "bg-emerald-50 border-l-4 border-emerald-500", textColor: "text-emerald-800" };
      }
      return { emoji: "📌", accent: "bg-slate-100 border-l-4 border-slate-400", textColor: "text-slate-700" };
    };

    const ensureMeta = (content: string) => {
      const base = resolveMeta(content);
      sectionCounter += 1;
      currentMeta = { ...base, number: sectionCounter };
      return currentMeta;
    };

    lines.forEach((line) => {
      // Detectar títulos (linhas com ###, ** ou que terminam com :)
      const isTitle = line.startsWith("###") || line.startsWith("##") || line.startsWith("#") || /:\s*$/.test(line);

      if (isTitle) {
        const content = line.replace(/^#+\s*/, "").replace(/:\s*$/, "");
        sectionCounter += 1;
        const metaBase = resolveMeta(content);
        currentMeta = { ...metaBase, number: sectionCounter };
        formatted.push({
          type: "title",
          content,
          meta: currentMeta,
        });
      }
      // Detectar itens de lista (começam com número, -, *, •, ou **)
      else if (/^(\d+[\.\)]\s|\-\s|\*\s|•\s|\*\*)/.test(line)) {
        const prefixMatch = line.match(/^(\d+[\.\)]|\-|\*|•)/);
        const prefix = prefixMatch ? prefixMatch[1].replace(/[\-*•]/, "").trim() : "";
        const content = line.replace(/^(\d+[\.\)]\s|\-\s|\*\s|•\s|\*\*)/, "").trim();
        const metaSource = currentMeta ? { ...currentMeta } : { ...ensureMeta(content) };
        const meta = metaSource ?? { ...defaultMeta };
        formatted.push({
          type: "list",
          content: content.length ? content : line,
          meta,
          listPrefix: prefix || (meta.number != null ? `${meta.number}` : undefined),
        });
      }
      // Texto normal
      else {
        const metaSource = currentMeta ? { ...currentMeta } : { ...ensureMeta(line) };
        const meta = metaSource ?? { ...defaultMeta };
        formatted.push({ type: "text", content: line, meta });
      }
    });

    return formatted;
  }, [aiSuggestion]);

  const handleGenerateInsights = async () => {
    if (!companyId) {
      setAiError("Selecione uma empresa para gerar recomendações.");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await generateInsights(companyId, focus ? { focus } : {});
      setAiSuggestion(response.suggestions);
      setInsightCreatedAt(response.createdAt ?? null);
    } catch (error) {
      console.error("Falha ao gerar insights IA", error);
      const message = error instanceof Error ? error.message : "Erro ao gerar recomendações";
      setAiError(message);
    } finally {
      setAiLoading(false);
    }
  };

  const summaryCards = useMemo(
    () => [
      {
        label: "Taxa de Conformidade",
        value: `${snapshot.overallConformity}%`,
        helper: riskLabels[snapshot.riskLevel].description,
        icon: CheckCircle2,
        accent: "text-emerald-600 bg-emerald-100",
      },
      {
        label: "Questionários Ativos",
        value: `${snapshot.sections.length}`,
        helper: `${snapshot.pendingQuestions.length} itens pendentes`,
        icon: ClipboardList,
        accent: "text-primary bg-primary/10",
      },
      {
        label: "Ações Pendentes",
        value: `${snapshot.pendingQuestions.length}`,
        helper: "Pendências aguardando evidência",
        icon: AlertTriangle,
        accent: "text-amber-600 bg-amber-100",
      },
      {
        label: "Avaliações Concluídas",
        value: `${snapshot.syncHistory.length}`,
        helper: "Sincronizações realizadas",
        icon: Activity,
        accent: "text-accent bg-accent/20",
      },
    ],
    [snapshot.pendingQuestions.length, snapshot.overallConformity, snapshot.sections.length, snapshot.syncHistory.length]
  );

  const doughnutData = useMemo(
    () => ({
      labels: ["Conforme", "Não conforme"],
      datasets: [
        {
          data: [snapshot.overallConformity, Math.max(0, 100 - snapshot.overallConformity)],
          backgroundColor: ["#10b981", "#f87171"],
          borderWidth: 0,
          cutout: "70%",
        },
      ],
    }),
    [snapshot.overallConformity]
  );

  const sectionBar = useMemo(() => {
    const labels = snapshot.sections.map((section) =>
      section.title.replace(/^\d+\.\s*/, "")
    );
    const data = snapshot.sections.map((section) => section.conformity);
    const backgroundColor = data.map((value) => {
      if (value >= 80) return "rgba(16, 185, 129, 0.75)";
      if (value >= 60) return "rgba(59, 130, 246, 0.75)";
      if (value >= 40) return "rgba(250, 204, 21, 0.75)";
      return "rgba(239, 68, 68, 0.75)";
    });
    return {
      labels,
      datasets: [
        {
          label: "Conformidade",
          data,
          backgroundColor,
          borderRadius: 12,
          borderSkipped: false,
        },
      ],
    };
  }, [snapshot.sections]);

  const sectionBarOptions = useMemo<ChartOptions<"bar">>(
    () => ({
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback(value: string | number) {
              return `${value}%`;
            },
          },
          grid: {
            color: "rgba(148, 163, 184, 0.2)",
          },
        },
        y: {
          grid: {
            display: false,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label(tooltipItem: TooltipItem<"bar">) {
              return `${tooltipItem.raw as number}% de conformidade`;
            },
          },
        },
      },
    }),
    []
  );

  const planStats = useMemo(() => {
    const pending = snapshot.pendingQuestions.length;
    const ongoing = Math.max(0, Math.round(pending * 0.4));
    const concluded = Math.max(0, Math.min(pending, Math.round(snapshot.overallCompletion / 25)));
    const delayed = Math.max(0, pending - ongoing - concluded);
    return {
      labels: ["Pendente", "Em andamento", "Concluído", "Atrasado"],
      data: [pending, ongoing, concluded, delayed],
    };
  }, [snapshot.pendingQuestions.length, snapshot.overallCompletion]);

  const barData = useMemo(
    () => ({
      labels: planStats.labels,
      datasets: [
        {
          label: "Planos",
          data: planStats.data,
          backgroundColor: ["#f97316", "#3b82f6", "#10b981", "#dc2626"],
          borderRadius: 12,
        },
      ],
    }),
    [planStats]
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <span className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide ${riskLabels[snapshot.riskLevel].chip}`}>
          <TrendingUp className="h-4 w-4" />
          {snapshot.riskLevel} risco
        </span>
        <h1 className="text-3xl font-semibold text-slate-900">Dashboard de Conformidade</h1>
        <p className="text-sm text-slate-500">
          Visão geral em tempo real do diagnóstico NR-1, permitindo monitorar conformidade,
          pendências e evolução dos planos de ação.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-elevated">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
                </div>
                <span className={`grid h-11 w-11 place-items-center rounded-xl text-lg font-semibold ${card.accent}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-4 text-xs text-slate-500">{card.helper}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-elevated lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Conformidade Geral</h2>
            <LineChart className="h-5 w-5 text-primary" />
          </div>
          <div className="relative mx-auto mt-6 h-48 w-48">
            <Doughnut
              data={doughnutData}
              options={{ plugins: { legend: { display: false } }, maintainAspectRatio: false }}
            />
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-3xl font-semibold text-primary">{snapshot.overallConformity}%</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">Conformidade</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-elevated lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Planos de ação por status</h2>
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-4 h-56">
            <Bar
              data={barData}
              options={{
                plugins: { legend: { display: false } },
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    grid: { color: "rgba(148, 163, 184, 0.2)" },
                  },
                  x: {
                    grid: { display: false },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-elevated lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Conformidade por seção</h2>
            <BarChart2 className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-4 h-56">
            <Bar data={sectionBar} options={sectionBarOptions} />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-elevated">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Histórico de sincronizações</h2>
              <p className="text-xs text-slate-500">Evolução dos indicadores de conformidade</p>
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          {snapshot.syncHistory.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <LineChart className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-500">
                Nenhuma sincronização registrada ainda
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Utilize o botão "Registrar sincronização" para acompanhar a evolução do diagnóstico
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {snapshot.syncHistory.map((entry) => (
                <div key={entry.timestamp} className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm transition hover:shadow-md">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {new Date(entry.timestamp).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(entry.timestamp).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Activity className="h-4 w-4 text-slate-400" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-slate-600">Conformidade</span>
                      </div>
                      <span className="text-sm font-bold text-primary">{entry.conformity}%</span>
                    </div>
                    
                    <div className="flex items-center justify-between rounded-lg bg-accent/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-accent" />
                        <span className="text-xs font-medium text-slate-600">Andamento</span>
                      </div>
                      <span className="text-sm font-bold text-accent">{entry.completion}%</span>
                    </div>
                  </div>
                  
                  {entry.note && (
                    <p className="mt-3 text-xs italic text-slate-500 line-clamp-2">
                      {entry.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-elevated">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Insights com IA</h2>
            <button
              type="button"
              onClick={handleGenerateInsights}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-primary/60"
            >
              {aiLoading ? "Gerando..." : "Gerar recomendações"}
            </button>
          </div>

          {user?.role === "ADMIN_GLOBAL" && !selectedCompanyId && (
            <p className="mt-3 rounded-xl border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Selecione uma empresa no topo para pedir recomendações personalizadas.
            </p>
          )}

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Foco opcional
            <textarea
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              placeholder="Descreva pontos de atenção ou metas para orientar a IA"
              className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
              rows={3}
            />
          </label>

          {aiError && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {aiError}
            </p>
          )}

          {aiSuggestion ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-800">
                    Análise de Conformidade NR-1
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Recomendações geradas pela IA com base nos dados da empresa
                  </p>
                  {insightCreatedAt && (
                    <p className="mt-1 text-xs text-slate-400">
                      Gerado em {new Date(insightCreatedAt).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {suggestionParagraphs.map((item, index) => {
                  if (item.type === "title" && item.meta) {
                    return (
                      <div key={`title-${index}`} className={`rounded-2xl border ${item.meta.accent} p-5 shadow-sm`}>
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-xl">{item.meta.emoji}</div>
                          <div className="flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              {item.meta.number != null ? `Seção ${item.meta.number}` : "Seção"}
                            </p>
                            <h4 className={`text-lg font-semibold ${item.meta.textColor}`}>{item.content}</h4>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (item.type === "list") {
                    const meta = item.meta ?? {
                      emoji: "📌",
                      accent: "border-slate-200",
                      textColor: "text-slate-700",
                      number: undefined,
                    };
                    const [rawTitle, ...restParts] = item.content.split(/\s+-\s+/);
                    const description = restParts.join(" - ").trim();
                    const badgeLabel = (() => {
                      switch (meta.emoji) {
                        case "🚨":
                          return "Ação imediata";
                        case "⚙️":
                          return "Ajuste tático";
                        case "🎯":
                          return "Estratégico";
                        case "✅":
                          return "Ponto forte";
                        default:
                          return "Recomendação";
                      }
                    })();

                    return (
                      <div
                        key={`list-${index}`}
                        className={`rounded-2xl border ${meta.accent} p-5 shadow-md transition duration-150 hover:shadow-lg`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-base font-semibold text-primary shadow-sm">
                            {item.listPrefix && item.listPrefix.length > 0 ? item.listPrefix : meta.number ?? "•"}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                <span>{meta.emoji}</span>
                                {badgeLabel}
                              </span>
                            </div>
                            <div className={`mt-2 text-sm font-semibold ${meta.textColor}`}>
                              {renderRichText(rawTitle.trim())}
                            </div>
                            {description ? (
                              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                {renderRichText(description)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <p key={`text-${index}`} className="rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-600 shadow-sm">
                      {renderRichText(item.content)}
                    </p>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <Sparkles className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-500">
                Nenhuma recomendação gerada ainda
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Clique no botão "Gerar recomendações" para obter insights personalizados
              </p>
            </div>
          )}
      </div>
    </section>
  );
}
