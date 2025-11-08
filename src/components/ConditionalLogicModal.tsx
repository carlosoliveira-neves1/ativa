import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import type { Questionnaire, Question } from "../config/questionnaire";
import {
  type ConditionalLogicAction,
  type ConditionalLogicCondition,
  type ConditionalLogicOperator,
  type ConditionalLogicRule,
  useQuestionnaireStore,
} from "../store/useQuestionnaireStore";
import { useNotifications } from "../hooks/useNotifications";

interface ConditionalLogicModalProps {
  questionnaire: Questionnaire;
  onClose: () => void;
}

interface EditableCondition {
  uid: string;
  sourceSectionId: string;
  sourceQuestionId: string;
  operator: ConditionalLogicOperator;
  value: string;
  valueEnd?: string;
  logicalOperator?: "AND" | "OR";
}

interface RuleFormState {
  id: string;
  name: string;
  description: string;
  sectionId: string;
  targetQuestionId: string;
  action: ConditionalLogicAction;
  actionPayloadWeight: string;
  enabled: boolean;
  conditions: EditableCondition[];
  createdAt?: string;
}

const DEFAULT_ACTION: ConditionalLogicAction = "show";

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyRule(sectionId: string | undefined): RuleFormState {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: "",
    description: "",
    sectionId: sectionId ?? "",
    targetQuestionId: "",
    action: DEFAULT_ACTION,
    actionPayloadWeight: "",
    enabled: true,
    conditions: [
      {
        uid: generateId(),
        sourceSectionId: sectionId ?? "",
        sourceQuestionId: "",
        operator: "equals",
        value: "",
      },
    ],
    createdAt: now,
  } satisfies RuleFormState;
}

function mapRuleToForm(rule: ConditionalLogicRule): RuleFormState {
  return {
    id: rule.id,
    name: rule.name ?? "",
    description: rule.description ?? "",
    sectionId: rule.sectionId,
    targetQuestionId: rule.targetQuestionId,
    action: rule.action,
    actionPayloadWeight: rule.action === "weight" && rule.actionPayload?.weight != null
      ? String(rule.actionPayload.weight)
      : "",
    enabled: rule.enabled,
    conditions: (rule.conditions ?? []).map((condition, index) => {
      let value = "";
      let valueEnd: string | undefined;
      if (Array.isArray(condition.value)) {
        value = condition.value[0] != null ? String(condition.value[0]) : "";
        valueEnd = condition.value[1] != null ? String(condition.value[1]) : "";
      } else {
        value = condition.value != null ? String(condition.value) : "";
      }
      return {
        uid: generateId(),
        sourceSectionId: condition.sourceSectionId,
        sourceQuestionId: condition.sourceQuestionId,
        operator: condition.operator,
        value,
        valueEnd,
        logicalOperator: index > 0 ? condition.logicalOperator ?? "AND" : undefined,
      } satisfies EditableCondition;
    }),
    createdAt: rule.createdAt,
  } satisfies RuleFormState;
}

function normalizeValue(
  condition: EditableCondition,
  question: Question | undefined
): string | number | [number, number] {
  const operator = condition.operator;
  const { value, valueEnd } = condition;

  if (operator === "between") {
    const first = Number(value ?? "");
    const second = Number(valueEnd ?? "");
    return [Number.isFinite(first) ? first : 0, Number.isFinite(second) ? second : first];
  }

  if (question?.type === "number" || question?.type === "range") {
    const parsed = Number(value ?? "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return value ?? "";
}

function buildConditionPayload(
  condition: EditableCondition,
  questionLookup: Map<string, Question>
): ConditionalLogicCondition {
  const key = `${condition.sourceSectionId}:${condition.sourceQuestionId}`;
  const question = questionLookup.get(key);
  return {
    sourceSectionId: condition.sourceSectionId,
    sourceQuestionId: condition.sourceQuestionId,
    operator: condition.operator,
    value: normalizeValue(condition, question),
    logicalOperator: condition.logicalOperator,
  } satisfies ConditionalLogicCondition;
}

function getQuestionOperators(question: Question | undefined): ConditionalLogicOperator[] {
  if (!question) {
    return ["equals", "not_equals"];
  }

  switch (question.type) {
    case "select":
      return ["equals", "not_equals", "contains", "not_contains"];
    case "number":
    case "range":
      return ["equals", "not_equals", "gt", "gte", "lt", "lte", "between"];
    case "textarea":
    case "text":
      return ["contains", "not_contains", "equals", "not_equals"];
    default:
      return ["equals", "not_equals"];
  }
}

function getConditionLabel(condition: ConditionalLogicRule["conditions"][number], questionnaire: Questionnaire) {
  const section = questionnaire.sections.find((sec) => sec.id === condition.sourceSectionId);
  const question = section?.questions.find((q) => q.id === condition.sourceQuestionId);
  const operatorLabels: Record<ConditionalLogicOperator, string> = {
    equals: "é",
    not_equals: "não é",
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
    between: "entre",
    contains: "contém",
    not_contains: "não contém",
  };
  const value = Array.isArray(condition.value)
    ? condition.value.join(" — ")
    : String(condition.value);

  return `${question?.label ?? "Pergunta"} ${operatorLabels[condition.operator]} ${value}`;
}

export function ConditionalLogicModal({ questionnaire, onClose }: ConditionalLogicModalProps) {
  const { addNotification } = useNotifications();
  const conditionalRules = useQuestionnaireStore((state) => state.conditionalRules);
  const upsertRule = useQuestionnaireStore((state) => state.upsertConditionalRule);
  const removeRule = useQuestionnaireStore((state) => state.removeConditionalRule);

  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    questionnaire.sections[0]?.id ?? ""
  );
  const [formState, setFormState] = useState<RuleFormState | null>(() =>
    createEmptyRule(questionnaire.sections[0]?.id)
  );
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  useEffect(() => {
    if (!formState?.sectionId && questionnaire.sections.length > 0) {
      setFormState((prev) =>
        prev
          ? { ...prev, sectionId: questionnaire.sections[0].id }
          : createEmptyRule(questionnaire.sections[0].id)
      );
    }
  }, [formState, questionnaire.sections]);

  const sectionRules = useMemo(
    () =>
      conditionalRules.filter((rule) =>
        selectedSectionId ? rule.sectionId === selectedSectionId : true
      ),
    [conditionalRules, selectedSectionId]
  );

  const questionLookup = useMemo(() => {
    const map = new Map<string, Question>();
    questionnaire.sections.forEach((section) => {
      section.questions.forEach((question) => {
        map.set(`${section.id}:${question.id}`, question);
      });
    });
    return map;
  }, [questionnaire.sections]);

  const handleSelectRule = (rule: ConditionalLogicRule) => {
    setIsEditingExisting(true);
    setSelectedSectionId(rule.sectionId);
    setFormState(mapRuleToForm(rule));
  };

  const handleCreateRule = () => {
    setIsEditingExisting(false);
    const baseSectionId = selectedSectionId || questionnaire.sections[0]?.id || "";
    setFormState(createEmptyRule(baseSectionId));
  };

  const handleDuplicateRule = (rule: ConditionalLogicRule) => {
    const now = new Date().toISOString();
    const duplicated: ConditionalLogicRule = {
      ...rule,
      id: generateId(),
      name: rule.name ? `${rule.name} (cópia)` : "Nova regra",
      createdAt: now,
      updatedAt: now,
    };
    upsertRule(duplicated);
    addNotification({ type: "success", message: "Regra duplicada com sucesso." });
  };

  const updateForm = <K extends keyof RuleFormState>(key: K, value: RuleFormState[K]) => {
    setFormState((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateCondition = (uid: string, updates: Partial<EditableCondition>) => {
    setFormState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        conditions: prev.conditions.map((condition, index) =>
          condition.uid === uid
            ? {
                ...condition,
                ...updates,
                logicalOperator:
                  index === 0 ? undefined : updates.logicalOperator ?? condition.logicalOperator ?? "AND",
              }
            : condition
        ),
      } satisfies RuleFormState;
    });
  };

  const addCondition = () => {
    setFormState((prev) => {
      if (!prev) return prev;
      const baseSection = prev.sectionId || questionnaire.sections[0]?.id || "";
      return {
        ...prev,
        conditions: [
          ...prev.conditions,
          {
            uid: generateId(),
            sourceSectionId: baseSection,
            sourceQuestionId: "",
            operator: "equals",
            value: "",
            logicalOperator: "AND",
          },
        ],
      } satisfies RuleFormState;
    });
  };

  const removeConditionFromForm = (uid: string) => {
    setFormState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        conditions: prev.conditions.filter((condition) => condition.uid !== uid),
      } satisfies RuleFormState;
    });
  };

  const handleToggleRule = (rule: ConditionalLogicRule) => {
    upsertRule({
      ...rule,
      enabled: !rule.enabled,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleRemoveRule = (rule: ConditionalLogicRule) => {
    removeRule(rule.id);
    addNotification({ type: "success", message: "Regra removida." });
    if (formState?.id === rule.id) {
      handleCreateRule();
    }
  };

  const handleDeleteCondition = (uid: string) => {
    removeConditionFromForm(uid);
  };

  const validateForm = (): string | null => {
    if (!formState) return "Selecione uma regra para editar.";
    if (!formState.sectionId) return "Escolha a seção alvo.";
    if (!formState.targetQuestionId) return "Selecione a pergunta que receberá a ação.";
    if (!formState.conditions.length) return "Adicione ao menos uma condição.";

    for (const condition of formState.conditions) {
      if (!condition.sourceSectionId || !condition.sourceQuestionId) {
        return "Defina a pergunta de origem para cada condição.";
      }
      if (!condition.value && condition.operator !== "between") {
        return "Informe o valor para cada condição.";
      }
      if (condition.operator === "between" && (!condition.value || !condition.valueEnd)) {
        return 'Informe os dois valores para operadores "entre".';
      }
    }

    if (formState.action === "weight") {
      const parsed = Number(formState.actionPayloadWeight);
      if (!Number.isFinite(parsed)) {
        return "Informe um peso numérico válido.";
      }
    }

    return null;
  };

  const handleSaveRule = () => {
    const error = validateForm();
    if (error) {
      addNotification({ type: "error", message: error });
      return;
    }
    if (!formState) return;

    const now = new Date().toISOString();
    const actionPayload =
      formState.action === "weight" && formState.actionPayloadWeight.trim().length > 0
        ? { weight: Number(formState.actionPayloadWeight) }
        : undefined;

    const convertedRule: ConditionalLogicRule = {
      id: formState.id,
      name: formState.name.trim() || undefined,
      description: formState.description.trim() || undefined,
      sectionId: formState.sectionId,
      targetQuestionId: formState.targetQuestionId,
      action: formState.action,
      actionPayload,
      enabled: formState.enabled,
      conditions: formState.conditions.map((condition, index) => (
        {
          sourceSectionId: condition.sourceSectionId,
          sourceQuestionId: condition.sourceQuestionId,
          operator: condition.operator,
          value: normalizeValue(condition, questionLookup.get(`${condition.sourceSectionId}:${condition.sourceQuestionId}`)),
          logicalOperator: index === 0 ? undefined : condition.logicalOperator ?? "AND",
        } satisfies ConditionalLogicCondition
      )),
      createdAt: isEditingExisting ? formState.createdAt ?? now : now,
      updatedAt: now,
    };

    upsertRule(convertedRule);
    addNotification({ type: "success", message: "Regra salva com sucesso." });
    setIsEditingExisting(true);
  };

  const currentSection = questionnaire.sections.find((section) => section.id === selectedSectionId);
  const currentSectionQuestions = currentSection?.questions ?? [];
  const targetQuestion = currentSectionQuestions.find((question) => question.id === formState?.targetQuestionId);

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-900/70 backdrop-blur">
      <div className="flex min-h-full items-start justify-center p-4">
        <div className="w-full max-w-7xl rounded-3xl bg-white p-6 shadow-2xl">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                <SlidersHorizontal className="h-4 w-4" />
                Lógica condicional
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">
                Controle condicional do formulário
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Configure regras para exibir, ocultar ou tornar perguntas obrigatórias com base em respostas anteriores.
                Todas as alterações são sincronizadas automaticamente.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-primary hover:text-primary"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1.35fr)]">
            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seções</p>
                <ul className="mt-3 space-y-2">
                  {questionnaire.sections.map((section) => {
                    const isActive = section.id === selectedSectionId;
                    const ruleCount = conditionalRules.filter((rule) => rule.sectionId === section.id).length;
                    return (
                      <li key={section.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSectionId(section.id);
                            setFormState((prev) =>
                              prev ? { ...prev, sectionId: section.id } : createEmptyRule(section.id)
                            );
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                            isActive
                              ? "bg-white text-primary shadow-sm"
                              : "text-slate-600 hover:bg-white hover:text-primary"
                          }`}
                        >
                          <span>{section.title.replace(/^\d+\.\s*/, "")}</span>
                          <span className={`ml-3 inline-flex min-w-[32px] items-center justify-center rounded-full text-xs ${
                            isActive ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-600"
                          }`}>
                            {ruleCount}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ações rápidas</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                    Regras ativas são aplicadas em tempo real na sincronização do formulário.
                  </p>
                  <p className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                    Certifique-se de evitar ciclos (uma pergunta condicionando a si mesma).
                  </p>
                </div>
              </div>
            </aside>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">Regras configuradas</h3>
                <button
                  type="button"
                  onClick={handleCreateRule}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
                >
                  <Plus className="h-4 w-4" /> Nova regra
                </button>
              </div>

              <div className="space-y-3">
                {sectionRules.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Nenhuma regra configurada para esta seção.
                    <br />
                    Utilize "Nova regra" para começar.
                  </div>
                ) : (
                  sectionRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`rounded-2xl border px-4 py-3 transition ${
                        formState?.id === rule.id ? "border-primary bg-primary/5" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {rule.name ?? "Regra sem título"}
                          </p>
                          <p className="text-xs text-slate-500">
                            Ação: {rule.action === "show" && "Exibir"}
                            {rule.action === "hide" && "Ocultar"}
                            {rule.action === "require" && "Tornar obrigatório"}
                            {rule.action === "weight" && "Aplicar peso"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            {rule.conditions.map((condition, index) => (
                              <span
                                key={`${rule.id}-${index}`}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                              >
                                {index > 0 && (
                                  <span className="font-semibold text-slate-400">
                                    {condition.logicalOperator ?? "AND"}
                                  </span>
                                )}
                                <ChevronRight className="h-3 w-3 text-slate-400" />
                                {getConditionLabel(condition, questionnaire)}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleRule(rule)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                              rule.enabled
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {rule.enabled ? "Ativa" : "Inativa"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectRule(rule)}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-primary hover:text-primary"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateRule(rule)}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-primary hover:text-primary"
                          >
                            <Copy className="h-3.5 w-3.5" /> Duplicar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRule(rule)}
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800">
                {isEditingExisting ? "Editar regra" : "Nova regra"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Defina as condições e a ação desejada. Regras são avaliadas na ordem listada.
              </p>

              {formState ? (
                <div className="mt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Nome da regra
                      </label>
                      <input
                        type="text"
                        value={formState.name}
                        onChange={(event) => updateForm("name", event.target.value)}
                        placeholder="Ex.: Ocultar plano de ação sem inventário"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Descrição (opcional)
                      </label>
                      <input
                        type="text"
                        value={formState.description}
                        onChange={(event) => updateForm("description", event.target.value)}
                        placeholder="Contextualize a lógica para a equipe"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Seção alvo
                      </label>
                      <select
                        value={formState.sectionId}
                        onChange={(event) => {
                          const value = event.target.value;
                          updateForm("sectionId", value);
                          setSelectedSectionId(value);
                          updateForm("targetQuestionId", "");
                        }}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      >
                        <option value="" disabled>
                          Selecione uma seção
                        </option>
                        {questionnaire.sections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Pergunta alvo
                      </label>
                      <select
                        value={formState.targetQuestionId}
                        onChange={(event) => updateForm("targetQuestionId", event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      >
                        <option value="" disabled>
                          Escolha a pergunta
                        </option>
                        {currentSectionQuestions.map((question) => (
                          <option key={question.id} value={question.id}>
                            {question.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Ação
                      </label>
                      <select
                        value={formState.action}
                        onChange={(event) => updateForm("action", event.target.value as ConditionalLogicAction)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      >
                        <option value="show">Exibir pergunta</option>
                        <option value="hide">Ocultar pergunta</option>
                        <option value="require">Tornar obrigatória</option>
                        <option value="weight">Aplicar peso customizado</option>
                      </select>
                    </div>
                  </div>

                  {formState.action === "weight" ? (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Peso customizado (0 a 100)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formState.actionPayloadWeight}
                        onChange={(event) => updateForm("actionPayloadWeight", event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-700">Condições</h4>
                      <button
                        type="button"
                        onClick={addCondition}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-primary hover:text-primary"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar condição
                      </button>
                    </div>

                    <div className="space-y-3">
                      {formState.conditions.map((condition, index) => {
                        const question = questionLookup.get(`${condition.sourceSectionId}:${condition.sourceQuestionId}`);
                        const operatorOptions = getQuestionOperators(question);
                        const showRangeFields = condition.operator === "between";
                        const isNumericOperator = ["gt", "gte", "lt", "lte", "between"].includes(condition.operator);
                        const valuePlaceholder = question?.type === "select"
                          ? "Selecione um valor"
                          : question?.type === "number" || question?.type === "range"
                          ? "Informe um número"
                          : "Informe o texto";

                        return (
                          <div
                            key={condition.uid}
                            className="rounded-2xl border border-slate-200 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Condição {index + 1}
                              </p>
                              {index > 0 ? (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-semibold text-slate-500">Operador lógico</span>
                                  <select
                                    value={condition.logicalOperator ?? "AND"}
                                    onChange={(event) =>
                                      updateCondition(condition.uid, {
                                        logicalOperator: event.target.value as "AND" | "OR",
                                      })
                                    }
                                    className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
                                  >
                                    <option value="AND">E</option>
                                    <option value="OR">OU</option>
                                  </select>
                                </div>
                              ) : null}
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-4">
                              <div className="space-y-2">
                                <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                                  Seção
                                </label>
                                <select
                                  value={condition.sourceSectionId}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    updateCondition(condition.uid, {
                                      sourceSectionId: value,
                                      sourceQuestionId: "",
                                    });
                                  }}
                                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                                >
                                  <option value="" disabled>
                                    Escolha a seção
                                  </option>
                                  {questionnaire.sections.map((section) => (
                                    <option key={section.id} value={section.id}>
                                      {section.title}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                                  Pergunta
                                </label>
                                <select
                                  value={condition.sourceQuestionId}
                                  onChange={(event) =>
                                    updateCondition(condition.uid, {
                                      sourceQuestionId: event.target.value,
                                    })
                                  }
                                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                                >
                                  <option value="" disabled>
                                    Escolha a pergunta
                                  </option>
                                  {questionnaire.sections
                                    .find((section) => section.id === condition.sourceSectionId)
                                    ?.questions.map((questionOption) => (
                                      <option key={questionOption.id} value={questionOption.id}>
                                        {questionOption.label}
                                      </option>
                                    ))}
                                </select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                                  Operador
                                </label>
                                <select
                                  value={condition.operator}
                                  onChange={(event) =>
                                    updateCondition(condition.uid, {
                                      operator: event.target.value as ConditionalLogicOperator,
                                      value: "",
                                      valueEnd: undefined,
                                    })
                                  }
                                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                                >
                                  {operatorOptions.map((operator) => (
                                    <option key={operator} value={operator}>
                                      {operator === "equals" && "Igual a"}
                                      {operator === "not_equals" && "Diferente de"}
                                      {operator === "gt" && "Maior que"}
                                      {operator === "gte" && "Maior ou igual"}
                                      {operator === "lt" && "Menor que"}
                                      {operator === "lte" && "Menor ou igual"}
                                      {operator === "between" && "Entre"}
                                      {operator === "contains" && "Contém"}
                                      {operator === "not_contains" && "Não contém"}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                                  Valor
                                </label>
                                {showRangeFields ? (
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="number"
                                      value={condition.value}
                                      onChange={(event) =>
                                        updateCondition(condition.uid, {
                                          value: event.target.value,
                                        })
                                      }
                                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                                      placeholder="Mín"
                                    />
                                    <input
                                      type="number"
                                      value={condition.valueEnd ?? ""}
                                      onChange={(event) =>
                                        updateCondition(condition.uid, {
                                          valueEnd: event.target.value,
                                        })
                                      }
                                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                                      placeholder="Máx"
                                    />
                                  </div>
                                ) : question?.type === "select" ? (
                                  <select
                                    value={condition.value}
                                    onChange={(event) =>
                                      updateCondition(condition.uid, {
                                        value: event.target.value,
                                      })
                                    }
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                                  >
                                    <option value="" disabled>
                                      Selecione
                                    </option>
                                    {question.options?.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type={isNumericOperator ? "number" : "text"}
                                    value={condition.value}
                                    onChange={(event) =>
                                      updateCondition(condition.uid, {
                                        value: event.target.value,
                                      })
                                    }
                                    placeholder={valuePlaceholder}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                                  />
                                )}
                              </div>
                            </div>

                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleDeleteCondition(condition.uid)}
                                className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Remover condição
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={handleCreateRule}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-primary hover:text-primary"
                    >
                      Limpar / Nova regra
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRule}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
                    >
                      Salvar regra
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
