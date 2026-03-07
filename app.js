const questionnaireConfig = {
  title: "Diagnóstico NR-1 - Unidade Matriz",
  sections: [
    {
      id: "contexto",
      title: "1. Contexto da Organização",
      description:
        "Identifique informações gerais da empresa e responsabilidades definidas.",
      questions: [
        {
          id: "c1",
          label: "Existe política formal de SST divulgada internamente?",
          type: "select",
          options: ["Sim", "Parcial", "Não"],
        },
        {
          id: "c2",
          label: "Nível de conformidade percebido",
          type: "range",
          min: 0,
          max: 100,
          step: 5,
        },
        {
          id: "c3",
          label: "Responsável principal pela NR-1",
          type: "text",
          placeholder: "Ex.: Coordenação de Segurança",
        },
      ],
    },
    {
      id: "avaliacao",
      title: "2. Avaliação de Riscos",
      description:
        "Verifique como a organização identifica perigos e avalia riscos ocupacionais.",
      questions: [
        {
          id: "a1",
          label:
            "Existe inventário atualizado de perigos e riscos (PGR)?",
          type: "select",
          options: ["Sim", "Parcial", "Não"],
        },
        {
          id: "a2",
          label:
            "Frequência de revisão do inventário de riscos (meses)",
          type: "number",
          min: 0,
          max: 36,
        },
        {
          id: "a3",
          label: "Evidências de avaliações recentes",
          type: "file",
        },
      ],
    },
    {
      id: "plano",
      title: "3. Planos de Ação",
      description:
        "Detalhe planos corretivos para itens não conformes e responsabilidades.",
      questions: [
        {
          id: "p1",
          label:
            "Itens não conformes possuem plano de ação formal?",
          type: "select",
          options: ["Sim", "Parcial", "Não"],
        },
        {
          id: "p2",
          label: "Descrição do plano mais crítico",
          type: "textarea",
        },
        {
          id: "p3",
          label:
            "Upload de evidências do plano (documento ou foto)",
          type: "file",
        },
      ],
    },
  ],
};

let localCache = {};
let syncHistory = [];
let trendChart;
let saveTimeout;

function loadFromLocal() {
  try {
    const raw = localStorage.getItem("ativa-nr1-prototipo");
    if (!raw) return;
    localCache = JSON.parse(raw);
  } catch (error) {
    console.warn("Falha ao carregar dados locais", error);
  }
}

function saveToLocal() {
  localStorage.setItem("ativa-nr1-prototipo", JSON.stringify(localCache));
}

function debouncedSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveToLocal();
    renderDashboard();
  }, 250);
}

function fakeCloudSync() {
  const statusEl = document.getElementById("syncStatus");
  statusEl.textContent = "Sincronizando...";
  statusEl.classList.add("pulsing");
  return new Promise((resolve) => {
    setTimeout(() => {
      saveToLocal();
      syncHistory.unshift({
        timestamp: new Date().toISOString(),
        score: calculateScore().averageConformity,
      });
      syncHistory = syncHistory.slice(0, 8);
      localStorage.setItem("ativa-nr1-sync", JSON.stringify(syncHistory));
      statusEl.textContent = "Sincronizado";
      statusEl.classList.remove("pulsing");
      setTimeout(() => {
        statusEl.textContent = "Pronto";
      }, 2000);
      resolve();
    }, 1200);
  });
}

function handleInputChange(sectionId, question, value) {
  if (!localCache[sectionId]) {
    localCache[sectionId] = {};
  }
  localCache[sectionId][question.id] = value;
  debouncedSave();
}

function renderQuestion(question, sectionId) {
  const wrapper = document.createElement("div");
  wrapper.className = "question";

  const label = document.createElement("label");
  label.setAttribute("for", question.id);
  label.textContent = question.label;
  wrapper.appendChild(label);

  let input;

  const value = localCache?.[sectionId]?.[question.id] ?? "";

  switch (question.type) {
    case "select": {
      input = document.createElement("select");
      question.options.forEach((option) => {
        const opt = document.createElement("option");
        opt.value = option;
        opt.textContent = option;
        input.appendChild(opt);
      });
      if (value) {
        input.value = value;
      } else {
        input.selectedIndex = -1;
      }
      break;
    }
    case "range": {
      input = document.createElement("div");
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = question.min;
      slider.max = question.max;
      slider.step = question.step || 1;
      slider.value = value || question.min;

      const output = document.createElement("span");
      output.className = "range-value";
      output.textContent = `${slider.value}% conformidade percebida`;

      slider.addEventListener("input", () => {
        output.textContent = `${slider.value}% conformidade percebida`;
      });

      slider.addEventListener("change", (event) => {
        handleInputChange(sectionId, question, Number(event.target.value));
      });

      input.appendChild(slider);
      input.appendChild(output);
      break;
    }
    case "textarea": {
      input = document.createElement("textarea");
      input.value = value;
      break;
    }
    case "file": {
      input = document.createElement("input");
      input.type = "file";
      if (localCache?.[sectionId]?.[question.id + "_name"]) {
        const fileName = document.createElement("small");
        fileName.textContent = `Arquivo salvo: ${localCache[sectionId][question.id + "_name"]}`;
        wrapper.appendChild(fileName);
      }
      input.addEventListener("change", (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          handleInputChange(sectionId, question, reader.result);
          localCache[sectionId][question.id + "_name"] = file.name;
          saveToLocal();
          renderQuestionnaire();
          renderDashboard();
        };
        reader.readAsDataURL(file);
      });
      break;
    }
    case "number": {
      input = document.createElement("input");
      input.type = "number";
      input.min = question.min ?? 0;
      input.max = question.max ?? 100;
      input.step = question.step ?? 1;
      input.value = value;
      break;
    }
    default: {
      input = document.createElement("input");
      input.type = "text";
      input.placeholder = question.placeholder ?? "";
      input.value = value;
    }
  }

  if (question.type !== "range" && question.type !== "file") {
    input.addEventListener("change", (event) => {
      const val =
        question.type === "number"
          ? Number(event.target.value)
          : event.target.value;
      handleInputChange(sectionId, question, val);
    });
  }

  wrapper.appendChild(input);

  if (question.help) {
    const small = document.createElement("small");
    small.textContent = question.help;
    wrapper.appendChild(small);
  }

  return wrapper;
}

function renderSection(section) {
  const sectionEl = document.createElement("article");
  sectionEl.className = "section";
  sectionEl.id = section.id;

  const title = document.createElement("h2");
  title.textContent = section.title;
  sectionEl.appendChild(title);

  if (section.description) {
    const description = document.createElement("p");
    description.textContent = section.description;
    sectionEl.appendChild(description);
  }

  section.questions.forEach((question) => {
    const questionEl = renderQuestion(question, section.id);
    sectionEl.appendChild(questionEl);
  });

  return sectionEl;
}

function renderQuestionnaire() {
  const container = document.getElementById("questionnaire");
  container.innerHTML = "";

  const title = document.createElement("h1");
  title.textContent = questionnaireConfig.title;
  container.appendChild(title);

  questionnaireConfig.sections.forEach((section) => {
    const sectionEl = renderSection(section);
    container.appendChild(sectionEl);
  });
}

function calculateScore() {
  const totalSections = questionnaireConfig.sections.length;
  const sectionScores = questionnaireConfig.sections.map((section) => {
    const data = localCache[section.id] || {};
    const answered = Object.keys(data).filter((key) => !key.endsWith("_name"));
    const completion = section.questions.length
      ? Math.round((answered.length / section.questions.length) * 100)
      : 0;

    let conformity = 0;
    if (data.c2) {
      conformity = data.c2;
    } else if (data.a2) {
      conformity = Math.min(100, (36 - data.a2) * 3);
    }

    return {
      id: section.id,
      title: section.title,
      completion,
      conformity: Math.max(0, Math.min(100, conformity)),
    };
  });

  const averageCompletion = Math.round(
    sectionScores.reduce((acc, score) => acc + score.completion, 0) /
      totalSections
  );

  const averageConformity = Math.round(
    sectionScores.reduce((acc, score) => acc + score.conformity, 0) /
      totalSections
  );

  return { sectionScores, averageCompletion, averageConformity };
}

function renderDashboard() {
  const { sectionScores, averageCompletion, averageConformity } =
    calculateScore();

  const overview = document.getElementById("overviewCard");
  overview.innerHTML = `
    <h3>Status geral</h3>
    <div class="score">${averageConformity || 0}%</div>
    <div class="meta">
      <span>Conformidade média estimada</span>
      <span>Progresso de preenchimento: ${averageCompletion || 0}%</span>
    </div>
    <span class="badge ${averageConformity > 70 ? "ok" : "alert"}">
      ${averageConformity > 70 ? "Dentro do esperado" : "Requer atenção"}
    </span>
  `;

  const sections = document.getElementById("sectionsCard");
  sections.innerHTML = `<h3>Seções</h3>`;
  const list = document.createElement("ul");
  list.className = "list";

  sectionScores.forEach((score) => {
    const item = document.createElement("li");
    item.className = "list-item";
    item.innerHTML = `
      <strong>${score.title}</strong>
      <span>Preenchimento: ${score.completion}%</span><br />
      <span>Conformidade estimada: ${score.conformity}%</span>
    `;
    list.appendChild(item);
  });

  sections.appendChild(list);

  renderTrend(sectionScores, averageConformity);
  renderTodos(sectionScores);
}

function renderTrend(sectionScores, averageConformity) {
  const ctx = document.getElementById("trendCanvas")?.getContext("2d");
  if (!ctx) return;

  if (!trendChart) {
    trendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: sectionScores.map((s) => s.title),
        datasets: [
          {
            label: "Conformidade por seção",
            data: sectionScores.map((s) => s.conformity),
            borderColor: "#31c0b5",
            backgroundColor: "rgba(49, 192, 181, 0.25)",
            tension: 0.35,
            fill: true,
            pointRadius: 5,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y}%`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (value) => `${value}%`,
            },
          },
        },
      },
    });
  } else {
    trendChart.data.labels = sectionScores.map((s) => s.title);
    trendChart.data.datasets[0].data = sectionScores.map((s) => s.conformity);
    trendChart.update();
  }
}

function renderTodos(sectionScores) {
  const todos = document.getElementById("todosCard");
  todos.innerHTML = `<h3>Próximas ações</h3>`;
  const todoList = document.createElement("ul");
  todoList.className = "list";

  const pendingSections = sectionScores.filter((score) => score.completion < 100);
  if (pendingSections.length === 0) {
    const item = document.createElement("li");
    item.className = "list-item";
    item.textContent = "Tudo preenchido por aqui. Revise e gere relatórios.";
    todoList.appendChild(item);
  } else {
    pendingSections.forEach((score) => {
      const item = document.createElement("li");
      item.className = "list-item";
      item.innerHTML = `
        <strong>${score.title}</strong>
        Completar ${100 - score.completion}% restante
      `;
      todoList.appendChild(item);
    });
  }

  todos.appendChild(todoList);

  if (syncHistory.length) {
    const divider = document.createElement("hr");
    divider.className = "divider";
    todos.appendChild(divider);

    const historyTitle = document.createElement("h4");
    historyTitle.textContent = "Últimas sincronizações";
    todos.appendChild(historyTitle);

    const historyList = document.createElement("ul");
    historyList.className = "list";
    syncHistory.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "list-item";
      item.innerHTML = `
        <strong>${new Date(entry.timestamp).toLocaleString("pt-BR")}</strong>
        Sincronizado com ${entry.score || 0}% de conformidade
      `;
      historyList.appendChild(item);
    });
    todos.appendChild(historyList);
  }
}

function init() {
  loadFromLocal();
  try {
    syncHistory = JSON.parse(localStorage.getItem("ativa-nr1-sync")) || [];
  } catch (error) {
    syncHistory = [];
  }
  renderQuestionnaire();
  renderDashboard();

  document.getElementById("saveButton").addEventListener("click", fakeCloudSync);
}

init();
