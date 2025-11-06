import { useState, useEffect, useMemo } from "react";
import {
  GraduationCap,
  Play,
  FileText,
  Award,
  Plus,
  Edit,
  Trash2,
  Users,
  CheckCircle,
  Clock,
  Eye,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

interface Training {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    userProgress: number;
    certificates: number;
  };
  userProgress: UserProgress | null;
}

interface Quiz {
  id: string;
  trainingId: string;
  title: string;
  passingScore: number;
  timeLimit?: number;
  isActive: boolean;
  createdAt?: string;
  questions?: QuizQuestion[];
}

interface QuizQuestion {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
}

interface UserProgress {
  status: "not_started" | "in_progress" | "completed";
  videoWatched: boolean;
  quizCompleted: boolean;
  certificateGenerated: boolean;
  lastAttempt: {
    attemptId: string;
    score: number;
    passed: boolean;
    completedAt: string;
  } | null;
  certificate: {
    id: string;
    url: string;
    issuedAt: string;
  } | null;
}

function formatStatusLabel(status: UserProgress["status"]) {
  switch (status) {
    case "completed":
      return "Concluído";
    case "in_progress":
      return "Em andamento";
    default:
      return "Não iniciado";
  }
}

export function TrainingPage() {
  const { user, token } = useAuthStore((state) => ({
    user: state.user,
    token: state.token,
  }));
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formVideoUrl, setFormVideoUrl] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizTraining, setQuizTraining] = useState<Training | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizForm, setQuizForm] = useState({
    id: "",
    title: "",
    passingScore: 70,
    timeLimit: 30,
    isActive: true,
    questions: [
      {
        prompt: "",
        options: ["", ""],
        correctOptionIndex: 0,
      },
    ] as QuizQuestion[],
  });
  const [isQuizSaving, setIsQuizSaving] = useState(false);
  const [quizFormError, setQuizFormError] = useState<string | null>(null);
  const [quizDeletingId, setQuizDeletingId] = useState<string | null>(null);

  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
    return raw.replace(/\/$/, "");
  }, []);

  useEffect(() => {
    setIsAdmin(user?.role === "ADMIN_GLOBAL" || user?.role === "COMPANY_ADMIN");
    loadTrainings();
  }, [user]);

  const loadTrainings = async () => {
    try {
      const sessionToken = token ?? localStorage.getItem("token");
      if (!sessionToken) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      const response = await fetch(`${apiBase}/trainings`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTrainings(data);
      }
    } catch (error) {
      console.error("Erro ao carregar treinamentos:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedTraining(null);
    setFormTitle("");
    setFormDescription("");
    setFormVideoUrl("");
    setFormIsActive(true);
    setErrorMessage(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (training: Training) => {
    setSelectedTraining(training);
    setFormTitle(training.title);
    setFormDescription(training.description);
    setFormVideoUrl(training.videoUrl);
    setFormIsActive(training.isActive);
    setErrorMessage(null);
    setShowCreateModal(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (!formTitle.trim() || !formDescription.trim() || !formVideoUrl.trim()) {
        setErrorMessage("Título, descrição e URL do vídeo são obrigatórios.");
        setIsSaving(false);
        return;
      }

      const sessionToken = token ?? localStorage.getItem("token");
      if (!sessionToken) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        videoUrl: formVideoUrl.trim(),
        isActive: formIsActive,
      };

      const isEditing = Boolean(selectedTraining);
      const url = `${apiBase}/trainings${isEditing ? `/${selectedTraining!.id}` : ""}`;
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: "Erro ao salvar treinamento." }));
        throw new Error(data.message || "Erro ao salvar treinamento.");
      }

      await loadTrainings();
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar treinamento:", error);
      setErrorMessage(error instanceof Error ? error.message : "Erro ao salvar treinamento.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (training: Training) => {
    if (!confirm(`Tem certeza que deseja excluir o treinamento "${training.title}"?`)) {
      return;
    }

    setIsDeleting(training.id);
    try {
      const sessionToken = token ?? localStorage.getItem("token");
      if (!sessionToken) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      const response = await fetch(`${apiBase}/trainings/${training.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: "Erro ao excluir treinamento." }));
        throw new Error(data.message || "Erro ao excluir treinamento.");
      }

      await loadTrainings();
    } catch (error) {
      console.error("Erro ao excluir treinamento:", error);
      alert(error instanceof Error ? error.message : "Erro ao excluir treinamento.");
    } finally {
      setIsDeleting(null);
    }
  };

  const getEmbedUrl = (videoUrl: string) => {
    // Converter URL do YouTube para embed
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = videoUrl.match(youtubeRegex);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
    return videoUrl;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const resetQuizForm = () => {
    setQuizForm({
      id: "",
      title: "",
      passingScore: 70,
      timeLimit: 30,
      isActive: true,
      questions: [
        {
          prompt: "",
          options: ["", ""],
          correctOptionIndex: 0,
        },
      ],
    });
    setQuizFormError(null);
  };

  const openQuizModal = async (training: Training) => {
    setQuizTraining(training);
    setShowQuizModal(true);
    setQuizError(null);
    resetQuizForm();
    setQuizLoading(true);

    try {
      const sessionToken = token ?? localStorage.getItem("token");
      if (!sessionToken) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      const response = await fetch(`${apiBase}/trainings/${training.id}/quizzes`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: "Erro ao buscar avaliações." }));
        throw new Error(data.message || "Erro ao buscar avaliações.");
      }

      const data: Quiz[] = await response.json();
      setQuizzes(data);
    } catch (error) {
      console.error("Erro ao carregar provas:", error);
      setQuizError(error instanceof Error ? error.message : "Erro ao carregar avaliações.");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleQuizQuestionChange = (index: number, updater: (question: QuizQuestion) => QuizQuestion) => {
    setQuizForm((prev) => {
      const questions = [...prev.questions];
      questions[index] = updater(questions[index]);
      return { ...prev, questions };
    });
  };

  const handleQuizOptionChange = (questionIndex: number, optionIndex: number, value: string) => {
    handleQuizQuestionChange(questionIndex, (question) => {
      const options = [...question.options];
      options[optionIndex] = value;
      return { ...question, options };
    });
  };

  const addQuestion = () => {
    setQuizForm((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          prompt: "",
          options: ["", ""],
          correctOptionIndex: 0,
        },
      ],
    }));
  };

  const removeQuestion = (index: number) => {
    setQuizForm((prev) => {
      if (prev.questions.length <= 1) {
        return prev;
      }
      const questions = prev.questions.filter((_, i) => i !== index);
      return { ...prev, questions };
    });
  };

  const addOption = (questionIndex: number) => {
    handleQuizQuestionChange(questionIndex, (question) => {
      const options = [...question.options, ""];
      return { ...question, options };
    });
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    handleQuizQuestionChange(questionIndex, (question) => {
      if (question.options.length <= 2) {
        return question;
      }
      const options = question.options.filter((_, idx) => idx !== optionIndex);
      let correctOptionIndex = question.correctOptionIndex;
      if (optionIndex === question.correctOptionIndex) {
        correctOptionIndex = 0;
      } else if (optionIndex < question.correctOptionIndex) {
        correctOptionIndex -= 1;
      }
      return { ...question, options, correctOptionIndex };
    });
  };

  const selectCorrectOption = (questionIndex: number, optionIndex: number) => {
    handleQuizQuestionChange(questionIndex, (question) => ({
      ...question,
      correctOptionIndex: optionIndex,
    }));
  };

  const openNewQuizForm = () => {
    resetQuizForm();
  };

  const openEditQuizForm = (quiz: Quiz) => {
    setQuizForm({
      id: quiz.id,
      title: quiz.title,
      passingScore: quiz.passingScore,
      timeLimit: quiz.timeLimit ?? 30,
      isActive: quiz.isActive,
      questions: quiz.questions ? quiz.questions.map((question) => ({ ...question })) : [],
    });
    if (!quiz.questions || quiz.questions.length === 0) {
      setQuizForm((prev) => ({
        ...prev,
        questions: [
          {
            prompt: "",
            options: ["", ""],
            correctOptionIndex: 0,
          },
        ],
      }));
    }
    setQuizFormError(null);
  };

  const handleQuizSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quizTraining) return;

    setIsQuizSaving(true);
    setQuizFormError(null);

    try {
      if (!quizForm.title.trim()) {
        setQuizFormError("Informe o título da avaliação.");
        setIsQuizSaving(false);
        return;
      }

      if (!quizForm.questions.every((question) => question.prompt.trim() && question.options.every((opt) => opt.trim()))) {
        setQuizFormError("Preencha todos os textos das questões e alternativas.");
        setIsQuizSaving(false);
        return;
      }

      const payload = {
        title: quizForm.title.trim(),
        passingScore: quizForm.passingScore,
        timeLimit: quizForm.timeLimit,
        isActive: quizForm.isActive,
        questions: quizForm.questions.map((question) => ({
          prompt: question.prompt.trim(),
          options: question.options.map((opt) => opt.trim()),
          correctOptionIndex: question.correctOptionIndex,
        })),
      };

      const sessionToken = token ?? localStorage.getItem("token");
      if (!sessionToken) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      const isEditing = Boolean(quizForm.id);
      const url = isEditing
        ? `${apiBase}/quizzes/${quizForm.id}`
        : `${apiBase}/trainings/${quizTraining.id}/quizzes`;
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: "Erro ao salvar avaliação." }));
        throw new Error(data.message || "Erro ao salvar avaliação.");
      }

      await openQuizModal(quizTraining);
      if (!isEditing) {
        resetQuizForm();
      }
    } catch (error) {
      console.error("Erro ao salvar quiz:", error);
      setQuizFormError(error instanceof Error ? error.message : "Erro ao salvar avaliação.");
    } finally {
      setIsQuizSaving(false);
    }
  };

  const handleQuizDelete = async (quiz: Quiz) => {
    if (!confirm(`Deseja excluir a avaliação "${quiz.title}"?`)) {
      return;
    }

    setQuizDeletingId(quiz.id);
    try {
      const sessionToken = token ?? localStorage.getItem("token");
      if (!sessionToken) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      const response = await fetch(`${apiBase}/quizzes/${quiz.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: "Erro ao excluir avaliação." }));
        throw new Error(data.message || "Erro ao excluir avaliação.");
      }

      await openQuizModal(quizTraining!);
    } catch (error) {
      console.error("Erro ao excluir quiz:", error);
      alert(error instanceof Error ? error.message : "Erro ao excluir avaliação.");
    } finally {
      setQuizDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <GraduationCap className="mx-auto h-12 w-12 animate-pulse text-primary" />
          <p className="mt-2 text-sm text-slate-600">Carregando treinamentos...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          <GraduationCap className="h-4 w-4" />
          Centro de Treinamentos
        </span>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Treinamentos EAD</h1>
            <p className="text-sm text-slate-500">
              Vídeos educativos, avaliações e certificados para capacitação contínua.
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-col gap-3 text-sm lg:flex-row lg:items-center">
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-semibold text-white shadow-elevated transition hover:bg-primary-dark"
              >
                <Plus className="h-4 w-4" />
                Novo Treinamento
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Estatísticas */}
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{trainings.length}</p>
          <p className="mt-3 text-xs text-slate-500">Treinamentos disponíveis</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ativos</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">
            {trainings.filter((t) => t.isActive).length}
          </p>
          <p className="mt-3 text-xs text-slate-500">Disponíveis para acesso</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alunos</p>
          <p className="mt-2 text-2xl font-semibold text-blue-600">
            {trainings.reduce((sum, t) => sum + (t._count?.userProgress || 0), 0)}
          </p>
          <p className="mt-3 text-xs text-slate-500">Total de matrículas</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Certificados</p>
          <p className="mt-2 text-2xl font-semibold text-purple-600">
            {trainings.reduce((sum, t) => sum + (t._count?.certificates || 0), 0)}
          </p>
          <p className="mt-3 text-xs text-slate-500">Certificados emitidos</p>
        </div>
      </div>

      {/* Lista de Treinamentos */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-elevated">
        <div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Todos os Treinamentos</h2>
            <p className="text-sm text-slate-500">
              {isAdmin 
                ? "Gerencie vídeos, avaliações e certificados."
                : "Acesse os vídeos e complete as avaliações."
              }
            </p>
          </div>
        </div>

        {trainings.length === 0 ? (
          <div className="text-center py-12">
            <GraduationCap className="mx-auto h-16 w-16 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-800">
              {isAdmin ? "Nenhum treinamento criado" : "Nenhum treinamento disponível"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {isAdmin 
                ? "Crie seu primeiro treinamento para começar."
                : "Volte em breve para novos conteúdos."
              }
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
              >
                <Plus className="h-4 w-4" />
                Criar Treinamento
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {trainings.map((training) => (
              <div
                key={training.id}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-elevated hover:border-primary/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-800 group-hover:text-primary">
                        {training.title}
                      </h3>
                      {training.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                          <CheckCircle className="h-3 w-3" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          <Clock className="h-3 w-3" />
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                      {training.description}
                    </p>
                    
                    {/* Preview do vídeo */}
                    <div className="mt-4 aspect-video overflow-hidden rounded-lg bg-slate-100">
                      <iframe
                        src={getEmbedUrl(training.videoUrl)}
                        title={training.title}
                        className="h-full w-full"
                        allowFullScreen
                      />
                    </div>

                    {/* Estatísticas */}
                    <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {training._count?.userProgress || 0} alunos
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        {training._count?.certificates || 0} certificados
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(training.createdAt)}
                      </span>
                    </div>

                    {/* Ações */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-dark">
                        <Play className="h-3 w-3" />
                        Assistir
                      </button>
                      <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                        <FileText className="h-3 w-3" />
                        Prova
                      </button>
                      {isAdmin && (
                        <>
                          <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                            <Eye className="h-3 w-3" />
                            Relatórios
                          </button>
                          <button
                            onClick={() => openQuizModal(training)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            <FileText className="h-3 w-3" />
                            Gerenciar provas
                          </button>
                          <button
                            onClick={() => openEditModal(training)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            <Edit className="h-3 w-3" />
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(training)}
                            disabled={isDeleting === training.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 className="h-3 w-3" />
                            {isDeleting === training.id ? "Excluindo..." : "Excluir"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isAdmin && showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  {selectedTraining ? "Editar Treinamento" : "Novo Treinamento"}
                </h3>
                <p className="text-sm text-slate-500">
                  {selectedTraining
                    ? "Atualize as informações do treinamento."
                    : "Cadastre um novo vídeo de treinamento."}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100"
              >
                <span className="sr-only">Fechar</span>
                ×
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="title">
                  Título
                </label>
                <input
                  id="title"
                  value={formTitle}
                  onChange={(event) => setFormTitle(event.target.value)}
                  placeholder="Informe o título do treinamento"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                  maxLength={120}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="description">
                  Descrição
                </label>
                <textarea
                  id="description"
                  value={formDescription}
                  onChange={(event) => setFormDescription(event.target.value)}
                  placeholder="Descreva o conteúdo do treinamento"
                  className="h-32 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="videoUrl">
                  URL do vídeo
                </label>
                <input
                  id="videoUrl"
                  value={formVideoUrl}
                  onChange={(event) => setFormVideoUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
                <p className="text-xs text-slate-500">
                  Aceitamos URLs do YouTube ou links diretos para vídeos hospedados.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">Treinamento ativo</p>
                  <p className="text-xs text-slate-500">Controle se o treinamento está visível aos usuários.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={formIsActive}
                    onChange={(event) => setFormIsActive(event.target.checked)}
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[4px] after:top-[4px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-5" />
                </label>
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {errorMessage}
                </div>
              )}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 sm:flex-none"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none"
                >
                  {isSaving ? "Salvando..." : selectedTraining ? "Atualizar" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdmin && showQuizModal && quizTraining && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 px-4 py-6">
          <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Avaliações de {quizTraining.title}</h3>
                <p className="text-sm text-slate-500">Cadastre e gerencie as provas associadas a este treinamento.</p>
              </div>
              <button
                onClick={() => {
                  setShowQuizModal(false);
                  setQuizTraining(null);
                  setQuizzes([]);
                  resetQuizForm();
                }}
                className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100"
              >
                <span className="sr-only">Fechar</span>
                ×
              </button>
            </div>

            <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Avaliações existentes</h4>
                  <button
                    onClick={() => {
                      openNewQuizForm();
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-primary bg-white px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10"
                  >
                    <Plus className="h-3 w-3" /> Nova avaliação
                  </button>
                </div>

                {quizLoading ? (
                  <p className="text-sm text-slate-500">Carregando avaliações...</p>
                ) : quizError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {quizError}
                  </div>
                ) : quizzes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                    Nenhuma avaliação cadastrada ainda.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quizzes.map((quiz) => (
                      <div key={quiz.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-semibold text-slate-800">{quiz.title}</h5>
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${quiz.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                {quiz.isActive ? "Ativo" : "Inativo"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              Nota mínima {quiz.passingScore}% · Tempo limite {quiz.timeLimit ?? 0} min · {quiz.questions?.length ?? 0} questões
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => openEditQuizForm(quiz)}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                            >
                              <Edit className="h-3 w-3" /> Editar
                            </button>
                            <button
                              onClick={() => handleQuizDelete(quiz)}
                              disabled={quizDeletingId === quiz.id}
                              className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 className="h-3 w-3" /> {quizDeletingId === quiz.id ? "Excluindo..." : "Excluir"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {quizForm.id ? "Editar avaliação" : "Nova avaliação"}
                  </h4>
                </div>

                <form className="space-y-4" onSubmit={handleQuizSubmit}>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="quizTitle">
                      Título da avaliação
                    </label>
                    <input
                      id="quizTitle"
                      value={quizForm.title}
                      onChange={(event) => setQuizForm((prev) => ({ ...prev, title: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Ex.: Avaliação NR-1"
                      required
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="passingScore">
                        Nota mínima (% )
                      </label>
                      <input
                        id="passingScore"
                        type="number"
                        min={0}
                        max={100}
                        value={quizForm.passingScore}
                        onChange={(event) => setQuizForm((prev) => ({ ...prev, passingScore: Number(event.target.value) }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="timeLimit">
                        Tempo limite (min)
                      </label>
                      <input
                        id="timeLimit"
                        type="number"
                        min={5}
                        max={600}
                        value={quizForm.timeLimit}
                        onChange={(event) => setQuizForm((prev) => ({ ...prev, timeLimit: Number(event.target.value) }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Avaliação ativa</p>
                      <p className="text-xs text-slate-500">Somente avaliações ativas ficam disponíveis para os usuários.</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={quizForm.isActive}
                        onChange={(event) => setQuizForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                      />
                      <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[4px] after:top-[4px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-5" />
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Questões</p>
                      <button
                        type="button"
                        onClick={addQuestion}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        <Plus className="h-3 w-3" /> Questão
                      </button>
                    </div>

                    {quizForm.questions.map((question, questionIndex) => (
                      <div key={questionIndex} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <label className="flex-1 text-xs font-semibold text-slate-600">
                            Enunciado da questão
                            <textarea
                              value={question.prompt}
                              onChange={(event) =>
                                handleQuizQuestionChange(questionIndex, (prev) => ({
                                  ...prev,
                                  prompt: event.target.value,
                                }))
                              }
                              className="mt-1 h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              placeholder="Descreva a pergunta..."
                              required
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removeQuestion(questionIndex)}
                            className="h-9 w-9 rounded-full border border-red-200 text-red-600 transition hover:bg-red-50"
                            disabled={quizForm.questions.length === 1}
                          >
                            ×
                          </button>
                        </div>

                        <div className="mt-3 space-y-2">
                          {question.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${questionIndex}`}
                                checked={question.correctOptionIndex === optionIndex}
                                onChange={() => selectCorrectOption(questionIndex, optionIndex)}
                                className="h-4 w-4" 
                              />
                              <input
                                value= {option}
                                onChange={(event) => handleQuizOptionChange(questionIndex, optionIndex, event.target.value)}
                                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder={`Alternativa ${optionIndex + 1}`}
                                required
                              />
                              <button
                                type="button"
                                onClick={() => removeOption(questionIndex, optionIndex)}
                                className="h-8 w-8 rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                                disabled={question.options.length <= 2}
                              >
                                –
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addOption(questionIndex)}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            <Plus className="h-3 w-3" /> Alternativa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {quizFormError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                      {quizFormError}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={resetQuizForm}
                      className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 sm:flex-none"
                      disabled={isQuizSaving}
                    >
                      Limpar
                    </button>
                    <button
                      type="submit"
                      disabled={isQuizSaving}
                      className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none"
                    >
                      {isQuizSaving ? "Salvando..." : quizForm.id ? "Atualizar avaliação" : "Adicionar avaliação"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
