import { ClipboardList, FilePlus2, Search, SlidersHorizontal } from "lucide-react";
import { QuestionnaireForm } from "../components/QuestionnaireForm";
import { questionnaire } from "../config/questionnaire";
import { useQuestionnaireStore } from "../store/useQuestionnaireStore";
import { useCloudSync } from "../hooks/useCloudSync";

export function QuestionnairesPage() {
  useCloudSync();

  const responses = useQuestionnaireStore((state) => state.responses);
  const activeCount = new Set(Object.keys(responses)).size;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          <ClipboardList className="h-4 w-4" />
          Gestão de Questionários
        </span>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Questionários de Conformidade</h1>
            <p className="text-sm text-slate-500">
              Cadastre e acompanhe formulários baseados na NR-1 para manter o monitoramento contínuo
              da conformidade em todas as unidades.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm lg:flex-row lg:items-center">
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-600 shadow-sm transition hover:border-primary hover:text-primary">
              <Search className="h-4 w-4" />
              Pesquisar questionários
            </button>
            <button className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-semibold text-white shadow-elevated transition hover:bg-primary-dark">
              <FilePlus2 className="h-4 w-4" />
              Novo questionário
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ativos</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{activeCount}</p>
          <p className="mt-3 text-xs text-slate-500">Questionários com respostas registradas</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seções</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{questionnaire.sections.length}</p>
          <p className="mt-3 text-xs text-slate-500">Distribuídas nos temas da NR-1</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidências</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {questionnaire.sections.reduce(
              (total, section) => total + section.questions.filter((q) => q.type === "file").length,
              0
            )}
          </p>
          <p className="mt-3 text-xs text-slate-500">Uploads esperados por auditoria</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-elevated">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Formulário ativo</h2>
            <p className="text-sm text-slate-500">
              Atualize continuamente para manter a visibilidade do cumprimento da NR-1.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1">
              <SlidersHorizontal className="h-4 w-4" />
              Ajustar lógica condicional
            </span>
          </div>
        </div>

        <div className="mt-6">
          <QuestionnaireForm questionnaire={questionnaire} />
        </div>
      </div>
    </section>
  );
}
