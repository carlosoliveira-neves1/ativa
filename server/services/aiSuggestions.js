// Configuração de IA - Suporta Groq ou Hugging Face
const AI_PROVIDER = process.env.AI_PROVIDER ?? "groq"; // "groq" ou "huggingface"
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.1-70b-versatile";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_MODEL = process.env.HUGGINGFACE_MODEL ?? "mistralai/Mistral-7B-Instruct-v0.2";
const HUGGINGFACE_ENDPOINT =
  process.env.HUGGINGFACE_ENDPOINT ??
  `https://router.huggingface.co/hf-inference/models/${HUGGINGFACE_MODEL}`;

const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS ?? 600);

export function isAiConfigured() {
  if (AI_PROVIDER === "groq") {
    return Boolean(GROQ_API_KEY);
  }
  return Boolean(HUGGINGFACE_API_KEY);
}

function formatActionPlanStats(stats = []) {
  if (!stats.length) {
    return "Nenhum plano de ação registrado.";
  }
  return stats
    .map((item) => `${item.label}: ${item.count}`)
    .join("; ");
}

function formatRecentItems(items = [], formatter) {
  if (!items.length) {
    return "Sem registros recentes.";
  }
  return items.map(formatter).join("\n");
}

export async function generateCompanyInsights({ company, metrics, focus, actor, limit }) {
  // Verificar configuração
  if (AI_PROVIDER === "groq" && !GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY não configurada");
  }
  if (AI_PROVIDER === "huggingface" && !HUGGINGFACE_API_KEY) {
    throw new Error("HUGGINGFACE_API_KEY não configurada");
  }

  const lines = [];
  lines.push(`Empresa: ${company.nomeFantasia} (${company.code})`);
  lines.push(`CNPJ: ${company.cnpj}`);
  lines.push(`Total de respostas ao questionário: ${metrics.responsesCount}`);

  lines.push("Resumo dos planos de ação:");
  lines.push(` - Total: ${metrics.actionPlans.total}`);
  lines.push(` - Por status: ${formatActionPlanStats(metrics.actionPlans.byStatus)}`);
  lines.push(` - Por criticidade: ${formatActionPlanStats(metrics.actionPlans.bySeverity)}`);
  lines.push(` - Planos em atraso: ${metrics.actionPlans.overdue}`);
  lines.push(" - Planos recentes:\n" + formatRecentItems(
    metrics.actionPlans.recent,
    (plan) =>
      `   • ${plan.title} | ${plan.status} | ${plan.severity} | vence em ${plan.dueDate ?? "sem prazo"}`
  ));

  lines.push("Histórico de sincronização:");
  lines.push(` - Total de sincronizações: ${metrics.sync.total}`);
  lines.push(
    ` - Média de conformidade: ${metrics.sync.avgConformity}% | Média de andamento: ${metrics.sync.avgCompletion}%`
  );
  if (metrics.sync.lastSync) {
    lines.push(
      ` - Última sincronização em ${metrics.sync.lastSync.timestamp} (conformidade ${metrics.sync.lastSync.conformity}%, andamento ${metrics.sync.lastSync.completion}%)`
    );
  }
  lines.push(
    " - Sincronizações recentes:\n" +
      formatRecentItems(
        metrics.sync.recent,
        (entry) =>
          `   • ${entry.timestamp} | conformidade ${entry.conformity}% | andamento ${entry.completion}% | nota: ${entry.note ?? "-"}`
      )
  );

  const focusText = focus ? `Ponto de atenção indicado pelo usuário: ${focus}.` : "";
  const actorText = actor
    ? `Requisição feita por um usuário com perfil ${actor.role}${
        actor.companyId ? " vinculado à empresa" : " com visão global"
      }.`
    : "";

  const instruction =
    "Você é um consultor especializado em segurança e conformidade trabalhista (NR-1). " +
    "Analise os dados a seguir e proponha recomendações práticas, priorizadas em ações imediatas, " +
    "ajustes de médio prazo e iniciativas estratégicas. Considere riscos, severidade, planos atrasados, " +
    "níveis de conformidade e ausência de evidências.";

  const cappedLimit = Math.max(1, Math.min(Number(limit ?? 5), 10));
  const prompt =
    `${instruction}\n${actorText}\n${focusText}\n` +
    `Gere até ${cappedLimit} recomendações.\n\nDados disponíveis:\n${lines.join("\n")}`;

  let response;
  
  if (AI_PROVIDER === "groq") {
    // Usar Groq (OpenAI-compatible)
    response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: instruction,
          },
          {
            role: "user",
            content: `${actorText}\n${focusText}\nGere até ${cappedLimit} recomendações.\n\nDados disponíveis:\n${lines.join("\n")}`,
          },
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0.4,
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Groq falhou (${response.status}): ${details}`);
    }

    const payload = await response.json();
    const suggestion = payload.choices?.[0]?.message?.content ?? "";
    
    const trimmed = String(suggestion ?? "").trim();
    if (!trimmed) {
      throw new Error("Resposta vazia do provedor de IA");
    }
    return trimmed;
  } else {
    // Usar Hugging Face
    response = await fetch(HUGGINGFACE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: MAX_TOKENS,
          temperature: 0.4,
          top_p: 0.9,
          return_full_text: false,
        },
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Hugging Face falhou (${response.status}): ${details}`);
    }

    const payload = await response.json();
    const suggestion = Array.isArray(payload)
      ? payload[0]?.generated_text ?? payload[0]?.text ?? payload[0]?.content ?? ""
      : payload.generated_text ?? payload.text ?? payload.content ?? "";

    const trimmed = String(suggestion ?? "").trim();
    if (!trimmed) {
      throw new Error("Resposta vazia do provedor de IA");
    }
    return trimmed;
  }
}
