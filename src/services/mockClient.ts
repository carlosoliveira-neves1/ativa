import type { ActionPlan, CloudState } from "../store/useQuestionnaireStore";
import type { AuthUser } from "../services/authClient";

// Mock data para demonstração sem backend
const mockUser: AuthUser = {
  id: "demo-user-id",
  name: "Usuário Demonstração",
  login: "demo",
  email: "demo@exemplo.com",
  role: "USER",
  company: {
    id: "demo-company-id",
    code: "DEMO",
    cnpj: "00.000.000/0001-00",
    nomeFantasia: "Empresa Demonstração LTDA",
    razaoSocial: "Empresa Demonstração LTDA",
    contactEmail: "contato@exemplo.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  questionnaireToken: "demo-token",
  checklistCode: "DEMO-001",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const mockCloudState: CloudState = {
  responses: {
    "c1": "Sim",
    "c2": 75,
    "c3": "Coordenação de Segurança",
    "a1": "Sim",
    "a2": 6,
    "p1": "Sim",
    "p2": "Sim",
    "p3": "Mensal",
    "t1": "Sim",
    "t2": 40,
    "e1": "Sim",
    "e2": "Sim",
    "e3": "Anual"
  },
  actionPlans: [
    {
      id: "plan-1",
      title: "Melhorar Sistema de Identificação de Perigos",
      description: "Implementar checklist mensal detalhado para identificação de novos perigos",
      category: "avaliacao",
      priority: "alta",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
      status: "pendente",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "plan-2", 
      title: "Atualizar Inventário de Riscos",
      description: "Revisar e atualizar o PGR com base nas novas regulamentações",
      category: "avaliacao",
      priority: "media",
      dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 dias
      status: "em_andamento",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  syncHistory: [
    {
      id: "sync-1",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 dia atrás
      type: "response_update",
      details: "Atualização de respostas do questionário"
    },
    {
      id: "sync-2",
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 dias atrás
      type: "action_plan_created",
      details: "Plano de ação criado: Melhorar Sistema de Identificação"
    }
  ],
  lastSyncAt: new Date().toISOString(),
  syncedAt: new Date().toISOString(),
  isDirty: false,
  pendingChanges: 0
};

// Simulação de delay de rede
const delay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

// Mock functions que simulam chamadas API
export async function mockLogin(login: string, password: string): Promise<{ token: string; user: AuthUser }> {
  await delay(1000);
  
  if (login === "demo" && password === "demo123") {
    return {
      token: "mock-jwt-token-demo",
      user: mockUser
    };
  }
  
  throw new Error("Credenciais inválidas. Use: demo / demo123");
}

export async function mockFetchCloudState(): Promise<CloudState> {
  await delay(800);
  return mockCloudState;
}

export async function mockPersistCloudState(state: CloudState): Promise<void> {
  await delay(600);
  console.log("Mock: Estado salvo localmente", state);
}

export async function mockAppendSyncEntry(entry: CloudState["syncHistory"][number]): Promise<void> {
  await delay(400);
  console.log("Mock: Entrada de sincronização adicionada", entry);
}

export async function mockFetchActionPlans(): Promise<ActionPlan[]> {
  await delay(500);
  return mockCloudState.actionPlans;
}

export async function mockPersistActionPlan(plan: ActionPlan): Promise<ActionPlan> {
  await delay(600);
  return { ...plan, id: plan.id || `plan-${Date.now()}` };
}

export async function mockRemoveActionPlan(id: string): Promise<void> {
  await delay(400);
  console.log("Mock: Plano de ação removido", id);
}

export function isMockMode(): boolean {
  return import.meta.env.VITE_MOCK_MODE === "true" || !import.meta.env.VITE_CLOUD_API_URL;
}
