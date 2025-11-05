import { useState, useEffect } from "react";
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
}

interface Quiz {
  id: string;
  trainingId: string;
  title: string;
  passingScore: number;
  timeLimit?: number;
  isActive: boolean;
}

export function TrainingPage() {
  const user = useAuthStore((state) => state.user);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(user?.role === "ADMIN_GLOBAL" || user?.role === "COMPANY_ADMIN");
    loadTrainings();
  }, [user]);

  const loadTrainings = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/trainings`, {
        headers: {
          Authorization: `Bearer ${token}`,
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
                onClick={() => setShowCreateModal(true)}
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
                          <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                            <Edit className="h-3 w-3" />
                            Editar
                          </button>
                          <button className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50">
                            <Trash2 className="h-3 w-3" />
                            Excluir
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
    </section>
  );
}
