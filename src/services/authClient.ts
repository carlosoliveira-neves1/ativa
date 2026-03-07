import { useAuthStore } from "../store/useAuthStore";
import { mockLogin, isMockMode } from "./mockClient";

const API_BASE = import.meta.env.VITE_CLOUD_API_URL ?? "http://localhost:4000";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Auth API error (${response.status})`);
  }
  return (await response.json()) as T;
}

export interface LoginPayload {
  companyCode?: string;
  login: string;
  password: string;
}

export interface SignupPayload {
  cnpj: string;
  email: string;
  login: string;
  password: string;
  nomeFantasia?: string;
  razaoSocial?: string;
}

export interface CompanySummary {
  id: string;
  code: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
}

export interface AuthUser {
  id: string;
  name: string;
  login: string;
  email: string | null;
  role: string;
  company: CompanySummary | null;
}

export interface LoginResponse {
  token: string;
  expiresIn: string;
  user: AuthUser;
}

export interface SignupResponse extends LoginResponse {
  companyCode: string;
  message: string;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  if (isMockMode()) {
    const result = await mockLogin(payload.login, payload.password);
    return {
      token: result.token,
      expiresIn: "12h",
      user: result.user,
    };
  }
  
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse<LoginResponse>(response);
}

export async function signup(payload: SignupPayload): Promise<SignupResponse> {
  if (isMockMode()) {
    throw new Error("Cadastro não disponível em modo de demonstração. Use login: demo / demo123");
  }
  
  const response = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse<SignupResponse>(response);
}

export interface ProfileResponse {
  user: AuthUser;
}

export async function fetchProfile(): Promise<ProfileResponse> {
  if (isMockMode()) {
    const token = useAuthStore.getState().token;
    if (!token) {
      throw new Error("Token ausente");
    }
    const result = await mockLogin("demo", "demo123");
    return { user: result.user };
  }
  
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error("Token ausente");
  }
  const response = await fetch(`${API_BASE}/auth/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 401) {
    useAuthStore.getState().clearSession();
    throw new Error("Sessão expirada");
  }
  return parseResponse<ProfileResponse>(response);
}

export interface CompaniesResponse {
  companies: CompanySummary[];
}

export async function listCompanies(search?: string): Promise<CompaniesResponse> {
  if (isMockMode()) {
    return {
      companies: [
        {
          id: "demo-company-id",
          code: "DEMO",
          nomeFantasia: "Empresa Demonstração LTDA",
          razaoSocial: "Empresa Demonstração LTDA",
          cnpj: "00.000.000/0001-00",
        },
      ],
    };
  }
  
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error("Token ausente");
  }
  const url = new URL(`${API_BASE}/companies`);
  if (search) {
    url.searchParams.set("search", search);
  }
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 401) {
    useAuthStore.getState().clearSession();
    throw new Error("Sessão expirada");
  }
  return parseResponse<CompaniesResponse>(response);
}

export interface InsightRequest {
  focus?: string;
  limit?: number;
}

export interface InsightResponse {
  suggestions: string | null;
  createdAt?: string;
  focus?: string;
}

export async function fetchInsights(companyId: string): Promise<InsightResponse> {
  if (isMockMode()) {
    return {
      suggestions:
        "Em modo de demonstração, os insights de IA não estão disponíveis. Configure uma API key da HuggingFace no backend para ativar esta funcionalidade.",
      focus: "demo",
      createdAt: new Date().toISOString(),
    };
  }
  
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error("Token ausente");
  }
  const response = await fetch(`${API_BASE}/companies/${companyId}/insights`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 401) {
    useAuthStore.getState().clearSession();
    throw new Error("Sessão expirada");
  }
  return parseResponse<InsightResponse>(response);
}

export async function generateInsights(
  companyId: string,
  payload: InsightRequest = {}
): Promise<InsightResponse> {
  if (isMockMode()) {
    return {
      suggestions:
        "Em modo de demonstração, a geração de insights por IA não está disponível. Configure uma API key da HuggingFace no backend para ativar esta funcionalidade.",
      focus: payload.focus || "demo",
      createdAt: new Date().toISOString(),
    };
  }
  
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error("Token ausente");
  }
  const response = await fetch(`${API_BASE}/companies/${companyId}/insights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (response.status === 401) {
    useAuthStore.getState().clearSession();
    throw new Error("Sessão expirada");
  }
  return parseResponse<InsightResponse>(response);
}
