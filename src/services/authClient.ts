import { useAuthStore } from "../store/useAuthStore";

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

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse<LoginResponse>(response);
}

export interface ProfileResponse {
  user: AuthUser;
}

export async function fetchProfile(): Promise<ProfileResponse> {
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
  suggestions: string;
}

export async function generateInsights(
  companyId: string,
  payload: InsightRequest = {}
): Promise<InsightResponse> {
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
