export type QuestionKind =
  | "select"
  | "range"
  | "number"
  | "text"
  | "textarea"
  | "file";

export interface QuestionOption {
  label: string;
  value: string;
  score: number;
  description?: string;
}

export interface Question {
  id: string;
  label: string;
  type: QuestionKind;
  description?: string;
  placeholder?: string;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: QuestionOption[];
  weight?: number;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  weight?: number;
}

export interface Questionnaire {
  title: string;
  sections: Section[];
}

export const questionnaire: Questionnaire = {
  title: "Diagnóstico NR-1 | Monitoramento Contínuo",
  sections: [
    {
      id: "contexto",
      title: "1. Contexto e Liderança",
      description:
        "Como a alta gestão estrutura responsabilidades de SST e dissemina a política de segurança.",
      questions: [
        {
          id: "politica_sst",
          label: "A política formal de SST está atualizada e divulgada?",
          type: "select",
          options: [
            { label: "Sim", value: "sim", score: 100 },
            { label: "Parcial", value: "parcial", score: 60 },
            { label: "Não", value: "nao", score: 20 },
          ],
        },
        {
          id: "engajamento_lideranca",
          label: "Engajamento da liderança nas reuniões de SST",
          type: "range",
          min: 0,
          max: 100,
          step: 5,
          help: "0% = nunca participa | 100% = participa de todas",
        },
        {
          id: "responsavel_principal",
          label: "Responsável principal pela NR-1",
          type: "text",
          placeholder: "Ex.: Coordenação de Segurança",
        },
        {
          id: "ultima_revisao_sgss",
          label: "Última revisão do Sistema de Gestão de SST",
          type: "text",
          placeholder: "mm/aaaa",
        },
      ],
    },
    {
      id: "avaliacao",
      title: "2. Avaliação de Riscos",
      description:
        "Inventário de perigos, avaliação de riscos ocupacionais e tratativas recentes.",
      questions: [
        {
          id: "inventario_atualizado",
          label: "Inventário de perigos e riscos (PGR) está atualizado?",
          type: "select",
          options: [
            { label: "Sim", value: "sim", score: 100 },
            { label: "Parcial", value: "parcial", score: 50 },
            { label: "Não", value: "nao", score: 10 },
          ],
        },
        {
          id: "revisao_meses",
          label: "Frequência de revisão do inventário (em meses)",
          type: "number",
          min: 0,
          max: 36,
          step: 1,
          help: "Quanto menor o intervalo, maior a conformidade",
        },
        {
          id: "evidencias_avaliacao",
          label: "Evidências das últimas avaliações",
          type: "file",
          description: "Anexe relatórios, fotos ou checklists",
        },
      ],
    },
    {
      id: "monitoramento",
      title: "3. Monitoramento Contínuo",
      description:
        "Como a empresa acompanha indicadores críticos e executa auditorias internas.",
      questions: [
        {
          id: "frequencia_monitoramento",
          label: "Periodicidade do monitoramento de indicadores críticos",
          type: "select",
          options: [
            { label: "Diário", value: "diario", score: 100 },
            { label: "Semanal", value: "semanal", score: 85 },
            { label: "Mensal", value: "mensal", score: 60 },
            { label: "Trimestral", value: "trimestral", score: 30 },
          ],
        },
        {
          id: "auditorias_internas",
          label: "Auditorias internas de conformidade NR-1",
          type: "select",
          options: [
            { label: "Ciclo contínuo", value: "continuo", score: 100 },
            { label: "Trimestral", value: "trimestral", score: 80 },
            { label: "Semestral", value: "semestral", score: 60 },
            { label: "Anual", value: "anual", score: 35 },
          ],
        },
        {
          id: "plano_monitoramento",
          label: "Resumo das últimas ações corretivas monitoradas",
          type: "textarea",
          placeholder: "Descreva o status das ações prioritárias",
        },
      ],
    },
    {
      id: "documentacao",
      title: "4. Documentação e Evidências",
      description:
        "Rastreabilidade, evidências e aprovação formal dos registros obrigatórios.",
      questions: [
        {
          id: "assinaturas_digitais",
          label: "Os documentos obrigatórios possuem assinatura digital válida?",
          type: "select",
          options: [
            { label: "Sim", value: "sim", score: 100 },
            { label: "Parcial", value: "parcial", score: 70 },
            { label: "Não", value: "nao", score: 30 },
          ],
        },
        {
          id: "gestao_evidencias",
          label: "Organização das evidências de conformidade",
          type: "range",
          min: 0,
          max: 100,
          step: 5,
          help: "0% = dispersas | 100% = centralizadas e auditáveis",
        },
        {
          id: "responsavel_documentacao",
          label: "Responsável pela guarda documental",
          type: "text",
          placeholder: "Ex.: Jurídico / Compliance",
        },
      ],
    },
    {
      id: "copsoq_identificacao",
      title: "Questionário COPSOQ-II · Parte 1 – Identificação",
      description: "Informações opcionais para contextualizar a avaliação psicossocial.",
      questions: [
        {
          id: "copsoq_nome",
          label: "Nome (opcional)",
          type: "text",
          placeholder: "Digite apenas se desejar se identificar",
        },
        {
          id: "copsoq_sexo",
          label: "Sexo",
          type: "select",
          options: [
            { label: "Masculino", value: "masculino", score: 0 },
            { label: "Feminino", value: "feminino", score: 0 },
            { label: "Outro", value: "outro", score: 0 },
            { label: "Prefiro não responder", value: "nao_informar", score: 0 },
          ],
        },
        {
          id: "copsoq_idade",
          label: "Idade",
          type: "number",
          min: 16,
          max: 80,
          placeholder: "Informe sua idade",
        },
        {
          id: "copsoq_setor",
          label: "Setor de atuação",
          type: "text",
          placeholder: "Ex.: Administrativo, Operacional",
        },
        {
          id: "copsoq_cargo",
          label: "Cargo ou função",
          type: "text",
          placeholder: "Ex.: Analista, Técnico, Supervisor",
        },
        {
          id: "copsoq_tempo_empresa",
          label: "Tempo de empresa",
          type: "select",
          options: [
            { label: "Menos de 6 meses", value: "menos_6_meses", score: 0 },
            { label: "6 meses a 1 ano", value: "6m_1a", score: 0 },
            { label: "1 a 3 anos", value: "1a3a", score: 0 },
            { label: "Mais de 3 anos", value: "mais_3a", score: 0 },
          ],
        },
        {
          id: "copsoq_turno",
          label: "Turno de trabalho",
          type: "select",
          options: [
            { label: "Diurno", value: "diurno", score: 0 },
            { label: "Noturno", value: "noturno", score: 0 },
            { label: "Escala / Revezamento", value: "escala", score: 0 },
          ],
        },
        {
          id: "copsoq_modalidade",
          label: "Teletrabalho ou presencial?",
          type: "select",
          options: [
            { label: "Presencial", value: "presencial", score: 0 },
            { label: "Híbrido", value: "hibrido", score: 0 },
            { label: "100% remoto", value: "remoto", score: 0 },
          ],
        },
      ],
    },
    {
      id: "copsoq_historico",
      title: "COPSOQ-II · Parte 2 – Histórico pessoal e fatores de vida",
      description: "Histórico de saúde mental e fatores externos que impactam o trabalho.",
      questions: [
        {
          id: "copsoq_transtorno",
          label:
            "Já foi diagnosticado(a) com algum transtorno mental?",
          type: "select",
          options: [
            { label: "Sim", value: "sim", score: 0 },
            { label: "Não", value: "nao", score: 0 },
            { label: "Prefiro não responder", value: "nao_informar", score: 0 },
          ],
        },
        {
          id: "copsoq_transtorno_qual",
          label: "Se sim, qual?",
          type: "text",
          placeholder: "Descreva o diagnóstico, se desejar",
          help: "Responder apenas se a pergunta anterior for 'Sim'",
        },
        {
          id: "copsoq_acompanhamento",
          label: "Já fez ou faz acompanhamento psicológico ou psiquiátrico?",
          type: "select",
          options: [
            { label: "Sim, atualmente", value: "atual", score: 0 },
            { label: "Sim, no passado", value: "passado", score: 0 },
            { label: "Nunca", value: "nunca", score: 0 },
          ],
        },
        {
          id: "copsoq_medicacao",
          label: "Já utilizou ou utiliza medicamentos psicotrópicos?",
          type: "select",
          options: [
            { label: "Sim, atualmente", value: "atual", score: 0 },
            { label: "Sim, no passado", value: "passado", score: 0 },
            { label: "Nunca", value: "nunca", score: 0 },
          ],
        },
        {
          id: "copsoq_afastamento",
          label: "Já teve afastamento do trabalho por motivo emocional/psicológico?",
          type: "select",
          options: [
            { label: "Sim", value: "sim", score: 0 },
            { label: "Não", value: "nao", score: 0 },
          ],
        },
        {
          id: "copsoq_eventos",
          label: "Já vivenciou em sua vida pessoal",
          type: "select",
          options: [
            { label: "Violência doméstica", value: "violencia_domestica", score: 0 },
            { label: "Abuso psicológico ou físico", value: "abuso", score: 0 },
            { label: "Luto traumático", value: "luto", score: 0 },
            { label: "Dependência química na família", value: "dependencia", score: 0 },
            { label: "Nenhuma das anteriores", value: "nenhuma", score: 0 },
          ],
        },
        {
          id: "copsoq_filhos",
          label: "Tem filhos ou pessoas sob sua responsabilidade direta?",
          type: "select",
          options: [
            { label: "Sim", value: "sim", score: 0 },
            { label: "Não", value: "nao", score: 0 },
          ],
        },
        {
          id: "copsoq_apoio",
          label: "Tem rede de apoio familiar ou social próxima?",
          type: "select",
          options: [
            { label: "Sim", value: "sim", score: 0 },
            { label: "Parcialmente", value: "parcial", score: 0 },
            { label: "Não", value: "nao", score: 0 },
          ],
        },
      ],
    },
    {
      id: "copsoq_fatores_trabalho",
      title: "COPSOQ-II · Parte 3 – Fatores psicossociais do trabalho",
      description: "Percepção sobre demandas, apoio e clima organizacional.",
      questions: [
        {
          id: "copsoq_volume_trabalho",
          label: "Sinto que o volume de trabalho é excessivo.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
          help: "1 = Nunca · 5 = Sempre",
        },
        {
          id: "copsoq_prazos_estresse",
          label: "Tenho prazos que geram muito estresse.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_exigencias_superiores",
          label: "As exigências do trabalho são superiores à minha capacidade.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_carga_distribuicao",
          label: "A carga de trabalho acumula-se por ser mal distribuída.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_tempo_tarefas",
          label: "Com que frequência não tem tempo para completar todas as tarefas do seu trabalho?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_trabalho_rapido",
          label: "Precisa trabalhar muito rapidamente?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_atencao_constante",
          label: "O seu trabalho exige a sua atenção constante?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_decisoes_dificeis",
          label: "O seu trabalho exige que tome decisões difíceis?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_exigencia_emocional",
          label: "O seu trabalho exige emocionalmente de si?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_influencia",
          label: "Tem um elevado grau de influência no seu trabalho?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_iniciativa",
          label: "O seu trabalho exige que tenha iniciativa?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_aprendizado",
          label: "O seu trabalho permite-lhe aprender coisas novas?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_informacoes_antecipadas",
          label:
            "No seu local de trabalho, é informado com antecedência sobre decisões importantes, mudanças ou planos para o futuro?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_informacoes_necessarias",
          label: "Recebe toda a informação de que necessita para fazer bem o seu trabalho?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_responsabilidades",
          label: "Sabe exatamente quais as suas responsabilidades?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_reconhecimento_gerencia",
          label: "O seu trabalho é reconhecido e apreciado pela gerência?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_justica",
          label: "É tratado de forma justa no seu local de trabalho?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_ambiente_colegas",
          label: "Existe um bom ambiente de trabalho entre si e os seus colegas?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_chefia_desenvolvimento",
          label: "A chefia oferece ao grupo boas oportunidades de desenvolvimento?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_chefia_planejamento",
          label: "A chefia é boa no planeamento do trabalho?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_confianca_funcionarios",
          label: "A gerência confia nos funcionários para fazerem o trabalho bem?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_confianca_informacao",
          label: "Confia na informação que lhe é transmitida pela gerência?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_conflitos_justos",
          label: "Os conflitos são resolvidos de uma forma justa?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_distribuicao_trabalho",
          label: "O trabalho é igualmente distribuído pelos funcionários?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_resolucao_problemas",
          label: "Sou sempre capaz de resolver problemas, se tentar o suficiente.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_significado",
          label: "O seu trabalho tem algum significado para si?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_importancia",
          label: "Sente que o seu trabalho é importante?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_identificacao_problemas",
          label: "Sente que os problemas do seu local de trabalho são seus também?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_satisfacao_global",
          label: "Quão satisfeito está com o seu trabalho de uma forma global?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_preocupacao_desemprego",
          label: "Sente-se preocupado em ficar desempregado?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_autonomia",
          label: "Posso tomar decisões sobre meu modo de trabalho.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_ideias",
          label: "Tenho espaço para apresentar ideias.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_reconhecimento_lideranca",
          label: "Meu trabalho é reconhecido pela liderança.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_clima_cooperativo",
          label: "O ambiente é cooperativo e respeitoso.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_conflitos_resolvidos",
          label: "Conflitos são resolvidos de maneira justa.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_comunicacao_clara",
          label: "A comunicação é clara e transparente.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_apoio_colegas",
          label: "Posso contar com colegas quando necessário.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_lideres_empaticos",
          label: "Meus líderes se mostram acessíveis e empáticos.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_pertenho_equipe",
          label: "Sinto que pertenço à equipe.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_esconder_sentimentos",
          label: "Preciso esconder o que sinto durante o expediente.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_emocionalmente_esgotado",
          label: "Sinto-me emocionalmente esgotado(a) após o trabalho.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_atendimento_sofrimento",
          label: "Atendo pessoas em sofrimento, crise ou conflito constante.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_assedio_moral",
          label: "Já fui vítima de assédio moral ou sexual na empresa.",
          type: "select",
          options: [
            { label: "Sim", value: "sim", score: 0 },
            { label: "Não", value: "nao", score: 0 },
          ],
        },
        {
          id: "copsoq_agressoes_verbais",
          label: "Já presenciei agressões verbais, ironias ou humilhações.",
          type: "select",
          options: [
            { label: "Sim", value: "sim", score: 0 },
            { label: "Não", value: "nao", score: 0 },
          ],
        },
        {
          id: "copsoq_medo_represalias",
          label: "Tenho medo de represálias ao expressar insatisfação.",
          type: "select",
          options: [
            { label: "Sim", value: "sim", score: 0 },
            { label: "Não", value: "nao", score: 0 },
          ],
        },
        {
          id: "copsoq_insultos",
          label: "Tem sido alvo de insultos ou provocações verbais?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
          help: "1 = Nunca/quase nunca · 5 = Sempre",
        },
        {
          id: "copsoq_assedio_sexual",
          label: "Tem sido exposto a assédio sexual indesejado?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_ameacas",
          label: "Tem sido exposto a ameaças de violência?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_violencia_fisica",
          label: "Tem sido exposto a violência física?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
      ],
    },
    {
      id: "copsoq_equilibrio",
      title: "COPSOQ-II · Parte 4 – Equilíbrio e qualidade de vida",
      description: "Impactos do trabalho na vida pessoal e saúde.",
      questions: [
        {
          id: "copsoq_interferencia_vida",
          label: "O trabalho interfere negativamente na minha vida pessoal ou familiar.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_dificuldade_relaxar",
          label: "Tenho dificuldade de relaxar ou dormir devido a preocupações com o trabalho.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_habitos_saudaveis",
          label: "Consigo manter hábitos saudáveis mesmo com a rotina profissional.",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_energia_vida_privada",
          label:
            "Sente que o seu trabalho lhe exige muita energia que acaba por afetar a sua vida privada negativamente?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_tempo_vida_privada",
          label:
            "Sente que o seu trabalho lhe exige muito tempo que acaba por afetar a sua vida privada negativamente?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_sono",
          label:
            "Durante as últimas 4 semanas, com que frequência acordou várias vezes durante a noite e depois não conseguia adormecer novamente?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_fisicamente_exausto",
          label: "Durante as últimas 4 semanas, sentiu-se fisicamente exausto?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_emocionalmente_exausto",
          label: "Durante as últimas 4 semanas, sentiu-se emocionalmente exausto?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_irritado",
          label: "Durante as últimas 4 semanas, sentiu-se irritado?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_ansioso",
          label: "Durante as últimas 4 semanas, sentiu-se ansioso?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
        {
          id: "copsoq_triste",
          label: "Durante as últimas 4 semanas, sentiu-se triste?",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
        },
      ],
    },
    {
      id: "copsoq_campo_aberto",
      title: "COPSOQ-II · Parte 5 – Campo aberto",
      description: "Espaço livre para relatos sobre saúde mental ou ambiente de trabalho.",
      questions: [
        {
          id: "copsoq_comentarios",
          label:
            "Você gostaria de relatar algo que considere importante sobre sua saúde mental ou ambiente de trabalho?",
          type: "textarea",
          placeholder: "Escreva aqui observações adicionais",
        },
      ],
    },
  ],
};
