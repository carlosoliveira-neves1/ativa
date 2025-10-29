import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Filter,
  Loader2,
  PencilLine,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useScoreSnapshot } from "../hooks/useScoreSnapshot";
import {
  appendSyncEntry,
  fetchActionPlans,
  persistActionPlan,
  removeActionPlanApi,
} from "../services/cloudClient";
import {
  useQuestionnaireStore,
  type ActionPlan,
  type ActionPlanSeverity,
  type ActionPlanStatus,
} from "../store/useQuestionnaireStore";

const statusOptions = ["Todos", "Pendentes", "Em andamento", "Concluídos", "Atrasados"];
const severityOptions = ["Todas", "Crítica", "Alta", "Média", "Baixa"];

const statusChoices: ActionPlanStatus[] = ["Pendente", "Em andamento", "Concluído", "Atrasado"];
const severityChoices: ActionPlanSeverity[] = ["Crítica", "Alta", "Média", "Baixa"];

export function ActionPlansPage() {
  const snapshot = useScoreSnapshot();
  const actionPlans = useQuestionnaireStore((state) => state.actionPlans);
  const upsertPlan = useQuestionnaireStore((state) => state.upsertActionPlan);
  const setPlans = useQuestionnaireStore((state) => state.setActionPlans);
  const removePlan = useQuestionnaireStore((state) => state.removeActionPlan);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ActionPlan | null>(null);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [formState, setFormState] = useState<ActionPlanForm>(() => createEmptyPlan());
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoadingPlans(true);
      try {
        const plans = await fetchActionPlans();
        if (isMounted) {
          setPlans(plans);
        }
      } catch (error) {
        console.warn("Não foi possível carregar planos da nuvem", error);
        if (isMounted) {
          setErrorMessage("Conecte a API local para sincronizar planos de ação.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingPlans(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [setPlans]);

  const openModal = (plan?: ActionPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormState(mapPlanToForm(plan));
    } else {
      setEditingPlan(null);
      setFormState(createEmptyPlan());
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setErrorMessage(null);
  };

  const handleChange = (field: keyof ActionPlanForm, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    const payload: ActionPlan = {
      ...formState,
      notes: formState.notes.trim() ? formState.notes.trim() : undefined,
      id: editingPlan?.id ?? crypto.randomUUID(),
      createdAt: editingPlan?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      upsertPlan(payload);
      await persistActionPlan(payload);
      await appendSyncEntry({
        timestamp: payload.updatedAt,
        conformity: snapshot.overallConformity,
        completion: snapshot.overallCompletion,
        note: editingPlan ? "Plano atualizado" : "Plano criado",
      });
      closeModal();
    } catch (error) {
      console.warn("Erro ao salvar plano", error);
      setErrorMessage("Não foi possível salvar. Verifique a API local.");
      upsertPlan(payload);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (plan: ActionPlan) => {
    removePlan(plan.id);
    try {
      await removeActionPlanApi(plan.id);
    } catch (error) {
      console.warn("Falha ao remover plano", error);
      setErrorMessage("Sem conexão com API: remoção apenas local.");
      upsertPlan(plan);
    }
  };

  const summary = useMemo(() => {
    const pendentes = actionPlans.filter((plan) => plan.status === "Pendente").length;
    const emAndamento = actionPlans.filter((plan) => plan.status === "Em andamento").length;
    const concluidos = actionPlans.filter((plan) => plan.status === "Concluído").length;
    const atrasados = actionPlans.filter((plan) => plan.status === "Atrasado").length;
    return { pendentes, emAndamento, concluidos, atrasados };
  }, [actionPlans]);

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
            <button
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-semibold text-white shadow-elevated transition hover:bg-primary-dark"
              onClick={() => openModal()}
            >
              <Plus className="h-4 w-4" />
              Novo plano de ação
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-4">
        <SummaryCard icon={AlertTriangle} label="Pendentes" value={summary.pendentes} accent="text-amber-600 bg-amber-100" />
        <SummaryCard icon={RefreshCcw} label="Em andamento" value={summary.emAndamento} accent="text-blue-600 bg-blue-100" />
        <SummaryCard icon={CheckCircle2} label="Concluídos" value={summary.concluidos} accent="text-emerald-600 bg-emerald-100" />
        <SummaryCard icon={CalendarClock} label="Atrasados" value={summary.atrasados} accent="text-red-600 bg-red-100" />
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

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {errorMessage}
          </p>
        ) : null}

        {isLoadingPlans ? (
          <div className="mt-6 grid place-items-center p-10 text-sm text-slate-500">
            <Loader2 className="mb-2 h-5 w-5 animate-spin text-primary" />
            Carregando planos de ação...
          </div>
        ) : actionPlans.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <CircleDot className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-700">Nenhum plano de ação criado</h3>
            <p className="mt-2 text-sm text-slate-500">
              Utilize o botão “Novo plano de ação” para gerar automaticamente ações a partir de itens não conformes.
            </p>
            <button
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-elevated transition hover:bg-primary-dark"
              onClick={() => openModal()}
            >
              <Plus className="h-4 w-4" /> Criar plano de ação
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {actionPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={() => openModal(plan)}
                onDelete={() => handleDelete(plan)}
              />
            ))}
          </div>
        )}
      </div>

      {isModalOpen ? (
        <PlanModal
          onClose={closeModal}
          onSubmit={handleSubmit}
          formState={formState}
          onChange={handleChange}
          isSaving={isSaving}
          isEditing={Boolean(editingPlan)}
        />
      ) : null}
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

interface ActionPlanForm {
  title: string;
  problemDescription: string;
  normativeItem: string;
  unitOrSector: string;
  correctiveAction: string;
  severity: ActionPlanSeverity;
  status: ActionPlanStatus;
  dueDate: string;
  responsible: string;
  notes: string;
}

function createEmptyPlan(): ActionPlanForm {
  return {
    title: "",
    problemDescription: "",
    normativeItem: "",
    unitOrSector: "",
    correctiveAction: "",
    severity: "Média",
    status: "Pendente",
    dueDate: "",
    responsible: "",
    notes: "",
  };
}

function mapPlanToForm(plan: ActionPlan): ActionPlanForm {
  return {
    title: plan.title,
    problemDescription: plan.problemDescription,
    normativeItem: plan.normativeItem,
    unitOrSector: plan.unitOrSector,
    correctiveAction: plan.correctiveAction,
    severity: plan.severity,
    status: plan.status,
    dueDate: plan.dueDate,
    responsible: plan.responsible,
    notes: plan.notes ?? "",
  };
}

interface PlanCardProps {
  plan: ActionPlan;
  onEdit: () => void;
  onDelete: () => void;
}

function PlanCard({ plan, onEdit, onDelete }: PlanCardProps) {
  return (
    <article className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {plan.severity}
          </span>
          <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            {plan.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-primary/10 hover:text-primary"
          >
            <PencilLine className="h-4 w-4" /> Editar
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100"
          >
            <Trash2 className="h-4 w-4" /> Remover
          </button>
        </div>
      </header>

      <div className="mt-4 space-y-3 text-sm text-slate-600">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{plan.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{plan.problemDescription}</p>
        </div>
        <div className="rounded-xl bg-primary/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Ação corretiva</p>
          <p className="text-sm text-primary">{plan.correctiveAction}</p>
        </div>
        <div className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>
            Item norma: <span className="font-semibold text-slate-700 normal-case">{plan.normativeItem || "-"}</span>
          </span>
          <span>
            Unidade / Setor: <span className="font-semibold text-slate-700 normal-case">{plan.unitOrSector || "-"}</span>
          </span>
          <span>
            Responsável: <span className="font-semibold text-slate-700 normal-case">{plan.responsible || "-"}</span>
          </span>
        </div>
      </div>

      <footer className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>
          Prazo: <strong>{plan.dueDate ? new Date(plan.dueDate).toLocaleDateString("pt-BR") : "Não definido"}</strong>
        </span>
        <span className="text-slate-400">
          Atualizado em {new Date(plan.updatedAt).toLocaleDateString("pt-BR")}
        </span>
      </footer>
    </article>
  );
}

interface PlanModalProps {
  onClose: () => void;
  onSubmit: () => void;
  onChange: (field: keyof ActionPlanForm, value: string) => void;
  formState: ActionPlanForm;
  isSaving: boolean;
  isEditing: boolean;
}

function PlanModal({ onClose, onSubmit, onChange, formState, isSaving, isEditing }: PlanModalProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/30 backdrop-blur">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-elevated sm:p-8">
          <header className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">{isEditing ? "Editar plano de ação" : "Novo plano de ação"}</h2>
              <p className="text-sm text-slate-500">
                Preencha as informações para acompanhar a correção da não conformidade.
              </p>
            </div>
          </header>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              label="Título *"
              placeholder="Ex: Implementar SESMT"
              value={formState.title}
              onChange={(value) => onChange("title", value)}
            />
            <InputField
              label="Unidade/Setor"
              placeholder="Ex: Matriz - São Paulo"
              value={formState.unitOrSector}
              onChange={(value) => onChange("unitOrSector", value)}
            />
            </div>
            <TextAreaField
              label="Descrição do Problema *"
              placeholder="Descreva a não conformidade identificada"
              value={formState.problemDescription}
              onChange={(value) => onChange("problemDescription", value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              label="Item da Norma"
              placeholder="Ex: NR-1 item 1.4.1"
              value={formState.normativeItem}
              onChange={(value) => onChange("normativeItem", value)}
            />
            <InputField
              label="Responsável *"
              placeholder="Nome do responsável pela ação"
              value={formState.responsible}
              onChange={(value) => onChange("responsible", value)}
            />
            </div>
            <TextAreaField
              label="Ação Corretiva *"
              placeholder="Descreva a ação que será implementada"
              value={formState.correctiveAction}
              onChange={(value) => onChange("correctiveAction", value)}
            />
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <SelectField
              label="Gravidade *"
              options={severityChoices}
              value={formState.severity}
              onChange={(value) => onChange("severity", value)}
            />
            <SelectField
              label="Status *"
              options={statusChoices}
              value={formState.status}
              onChange={(value) => onChange("status", value)}
            />
            <InputField
              label="Prazo *"
              type="date"
              value={formState.dueDate}
              onChange={(value) => onChange("dueDate", value)}
            />
            </div>
            <TextAreaField
              label="Observações"
              placeholder="Informações adicionais sobre o plano"
              value={formState.notes}
              onChange={(value) => onChange("notes", value)}
            />
          </div>

          <footer className="mt-6 flex flex-col-reverse gap-3 sm:mt-8 sm:flex-row sm:justify-end">
            <button
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-primary hover:text-primary"
            >
              Cancelar
            </button>
            <button
              onClick={onSubmit}
              disabled={isSaving}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-elevated transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}

function InputField({ label, value, onChange, placeholder, type = "text" }: InputFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function TextAreaField({ label, value, onChange, placeholder }: TextAreaFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600">
      {label}
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

