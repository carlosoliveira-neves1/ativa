import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Filter,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { useScoreSnapshot } from "../hooks/useScoreSnapshot";

const statusOptions = ["Todos", "Pendentes", "Em andamento", "Concluídos", "Atrasados"];
const severityOptions = ["Todas", "Crítica", "Alta", "Média", "Baixa"];

export function ActionPlansPage() {
  const snapshot = useScoreSnapshot();

  const pendentes = snapshot.pendingQuestions.length;
  const emAndamento = Math.max(0, Math.round(pendentes * 0.4));
  const concluidos = Math.max(0, Math.round(snapshot.overallCompletion / 10));
  const atrasados = Math.max(0, pendentes - emAndamento - concluidos);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          <ClipboardCheck className="h-4 w-4" />
          Planos de Ação
        </span>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Planos corretivos e preventivos</h1>
            <p className="text-sm text-slate-500">
              Gerencie ações derivadas das auditorias contínuas. Atribua responsáveis, prazos e acompanhe a conclusão.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm lg:flex-row lg:items-center">
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-600 shadow-sm transition hover:border-primary hover:text-primary">
              <Filter className="h-4 w-4" />
              Filtros salvos
            </button>
            <button className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-semibold text-white shadow-elevated transition hover:bg-primary-dark">
              <Plus className="h-4 w-4" />
              Novo plano de ação
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-4">
        <SummaryCard icon={AlertTriangle} label="Pendentes" value={pendentes} accent="text-amber-600 bg-amber-100" />
        <SummaryCard icon={RefreshCcw} label="Em andamento" value={emAndamento} accent="text-blue-600 bg-blue-100" />
        <SummaryCard icon={CheckCircle2} label="Concluídos" value={concluidos} accent="text-emerald-600 bg-emerald-100" />
        <SummaryCard icon={CalendarClock} label="Atrasados" value={atrasados} accent="text-red-600 bg-red-100" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-elevated">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Filtros inteligentes</h2>
            <p className="text-sm text-slate-500">
              Configure filtros recorrentes para squads ou unidades antes de exportar relatórios.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Dropdown label="Status" options={statusOptions} />
            <Dropdown label="Gravidade" options={severityOptions} />
            <Dropdown label="Período" options={["Últimos 30 dias", "Últimos 90 dias", "Último ano"]} />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <CircleDot className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-700">Nenhum plano de ação criado</h3>
          <p className="mt-2 text-sm text-slate-500">
            Utilize o botão “Novo plano de ação” para gerar automaticamente ações a partir de itens não conformes.
          </p>
          <button className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-elevated transition hover:bg-primary-dark">
            <Plus className="h-4 w-4" /> Criar plano de ação
          </button>
        </div>
      </div>
    </section>
  );
}

interface SummaryCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: string;
}

function SummaryCard({ icon: Icon, label, value, accent }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-elevated">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-xl text-lg font-semibold ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

interface DropdownProps {
  label: string;
  options: string[];
}

function Dropdown({ label, options }: DropdownProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600">
      {label}
      <span className="inline-flex items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
        {options[0]}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </span>
    </label>
  );
}
