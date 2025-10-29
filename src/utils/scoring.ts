import type { Questionnaire } from "../config/questionnaire";
import type {
  QuestionnaireResponses,
  QuestionResponse,
  SectionResponses,
  SyncEntry,
} from "../store/useQuestionnaireStore";

export interface SectionScore {
  id: string;
  title: string;
  completion: number;
  conformity: number;
  outstanding: number;
  answered: number;
  total: number;
  evidenceCoverage: number;
}

export interface EvidenceInsight {
  sectionId: string;
  title: string;
  missing: number;
}

export interface ScoreSnapshot {
  timestamp: string;
  overallCompletion: number;
  overallConformity: number;
  riskLevel: "Alto" | "Moderado" | "Baixo";
  sections: SectionScore[];
  insights: string[];
  evidenceInsights: EvidenceInsight[];
  pendingQuestions: { sectionId: string; questionId: string; label: string }[];
  syncHistory: SyncEntry[];
  trendPoints: { label: string; value: number }[];
}

const MINUTES_PER_MONTH = 43200; // 30 days * 24h * 60

export function calculateScoreSnapshot(
  questionnaire: Questionnaire,
  responses: QuestionnaireResponses,
  syncHistory: SyncEntry[]
): ScoreSnapshot {
  const sections = questionnaire.sections.map((section) =>
    buildSectionScore(section.id, section.title, section.questions, responses[section.id])
  );

  const overallCompletion = Math.round(
    average(sections.map((section) => section.completion))
  );
  const overallConformity = Math.round(
    average(sections.map((section) => section.conformity))
  );

  const riskLevel = deriveRiskLevel(overallConformity, overallCompletion);

  const pendingQuestions = questionnaire.sections.flatMap((section) => {
    const sectionData = responses[section.id] ?? {};
    return section.questions
      .filter((question) => !hasQuestionResponse(sectionData[question.id]))
      .map((question) => ({
        sectionId: section.id,
        questionId: question.id,
        label: `${section.title} · ${question.label}`,
      }));
  });

  const evidenceInsights = questionnaire.sections
    .map((section) => {
      const sectionData = responses[section.id] ?? {};
      const evidenceQuestions = section.questions.filter((question) => question.type === "file");
      if (!evidenceQuestions.length) return null;

      const missing = evidenceQuestions.filter((question) => {
        const response = sectionData[question.id];
        return !(response?.attachmentData && response.attachmentName);
      }).length;

      return {
        sectionId: section.id,
        title: section.title,
        missing,
      } satisfies EvidenceInsight;
    })
    .filter(Boolean) as EvidenceInsight[];

  const insights = buildNarrativeInsights({
    overallCompletion,
    overallConformity,
    riskLevel,
    sections,
    pendingCount: pendingQuestions.length,
    evidenceInsights,
  });

  const trendPoints = syncHistory.length
    ? syncHistory
        .slice()
        .reverse()
        .map((entry, index) => ({
          label: formatTrendLabel(entry.timestamp, index === syncHistory.length - 1),
          value: entry.conformity,
        }))
    : buildSyntheticTrend(overallConformity);

  return {
    timestamp: new Date().toISOString(),
    overallCompletion,
    overallConformity,
    riskLevel,
    sections,
    insights,
    evidenceInsights,
    pendingQuestions,
    syncHistory,
    trendPoints,
  };
}

function buildSectionScore(
  sectionId: string,
  title: string,
  questions: Questionnaire["sections"][number]["questions"],
  sectionResponses: SectionResponses | undefined
): SectionScore {
  const responses = sectionResponses ?? {};
  const total = questions.length;
  let answered = 0;
  const evidenceQuestions = questions.filter((question) => question.type === "file");
  let evidenceCount = 0;

  const scores = questions.map((question) => {
    const response = responses[question.id];
    if (!hasQuestionResponse(response)) {
      return 0;
    }
    answered += 1;

    if (question.type === "file" && response?.attachmentData) {
      evidenceCount += 1;
    }

    return deriveQuestionScore(question, response);
  });

  const completion = total ? Math.round((answered / total) * 100) : 0;
  const conformity = total ? Math.round(average(scores)) : 0;
  const outstanding = total - answered;
  const evidenceCoverage = evidenceQuestions.length
    ? Math.round((evidenceCount / evidenceQuestions.length) * 100)
    : 100;

  return {
    id: sectionId,
    title,
    completion,
    conformity,
    outstanding,
    answered,
    total,
    evidenceCoverage,
  };
}

function deriveQuestionScore(
  question: Questionnaire["sections"][number]["questions"][number],
  response: QuestionResponse
): number {
  switch (question.type) {
    case "select": {
      const option = question.options?.find((option) => option.value === response.value);
      return option?.score ?? 0;
    }
    case "range": {
      return typeof response.value === "number" ? clamp(response.value, 0, 100) : 0;
    }
    case "number": {
      if (typeof response.value !== "number" || Number.isNaN(response.value)) {
        return 0;
      }
      if (response.value <= 0) return 100;
      const max = question.max ?? 36;
      const normalized = clamp(1 - response.value / max, 0, 1);
      return Math.round(normalized * 100);
    }
    case "textarea":
    case "text": {
      if (typeof response.value === "string" && response.value.trim().length > 0) {
        return 70;
      }
      return 0;
    }
    case "file": {
      return response.attachmentData ? 100 : 0;
    }
    default:
      return 0;
  }
}

function deriveRiskLevel(conformity: number, completion: number): ScoreSnapshot["riskLevel"] {
  if (conformity < 50 || completion < 40) return "Alto";
  if (conformity < 75) return "Moderado";
  return "Baixo";
}

function buildNarrativeInsights(args: {
  overallCompletion: number;
  overallConformity: number;
  riskLevel: ScoreSnapshot["riskLevel"];
  sections: SectionScore[];
  pendingCount: number;
  evidenceInsights: EvidenceInsight[];
}): string[] {
  const insights: string[] = [];
  insights.push(
    `Conformidade média atual em ${args.overallConformity}% com preenchimento de ${args.overallCompletion}%.`
  );

  if (args.riskLevel === "Alto") {
    insights.push("Risco elevado: priorize planos de ação antes da próxima auditoria.");
  } else if (args.riskLevel === "Moderado") {
    insights.push("Risco moderado: fortaleça evidências e monitore indicadores semanais.");
  } else {
    insights.push("Risco baixo: mantenha o ciclo contínuo e valide evidências críticas.");
  }

  const lowestSection = args.sections.slice().sort((a, b) => a.conformity - b.conformity)[0];
  if (lowestSection) {
    insights.push(
      `${lowestSection.title} apresenta conformidade de ${lowestSection.conformity}%. Avalie planos corretivos e responsáveis.`
    );
  }

  if (args.pendingCount > 0) {
    insights.push(
      `${args.pendingCount} itens aguardam preenchimento para garantir rastreabilidade total.`
    );
  }

  const evidenceGap = args.evidenceInsights.find((insight) => insight.missing > 0);
  if (evidenceGap) {
    insights.push(
      `${evidenceGap.title} possui evidências pendentes. Reforce uploads para cumprir exigências regulatórias.`
    );
  }

  return insights;
}

function buildSyntheticTrend(conformity: number): ScoreSnapshot["trendPoints"] {
  const snapshotTime = Date.now();
  return new Array(6).fill(null).map((_, index) => {
    const decay = Math.max(0, conformity - (5 - index) * 4);
    const timestamp = new Date(snapshotTime - (5 - index) * MINUTES_PER_MONTH * 60 * 1000);
    return {
      label: formatTrendLabel(timestamp.toISOString(), index === 5),
      value: clamp(decay, 0, 100),
    };
  });
}

function hasQuestionResponse(response: QuestionResponse | undefined): boolean {
  if (!response) return false;
  if (response.attachmentData && response.attachmentName) return true;
  if (typeof response.value === "number") return true;
  if (typeof response.value === "string" && response.value.trim().length > 0) return true;
  return false;
}

function average(values: number[]): number {
  const filtered = values.filter((value) => !Number.isNaN(value));
  if (!filtered.length) return 0;
  const total = filtered.reduce((sum, value) => sum + value, 0);
  return total / filtered.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatTrendLabel(timestamp: string, isLatest: boolean): string {
  const date = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const formatted = formatter.format(date);
  return isLatest ? `${formatted} · agora` : formatted;
}
