import type { ActionPlan, CloudState } from "../store/useQuestionnaireStore";
import { useAuthStore } from "../store/useAuthStore";
<<<<<<< HEAD
import { 
  mockFetchCloudState, 
  mockPersistCloudState, 
  mockAppendSyncEntry, 
  mockFetchActionPlans, 
  mockPersistActionPlan, 
  mockRemoveActionPlan,
  isMockMode 
} from "./mockClient";
=======
>>>>>>> c1be563cc4fa16c77632d79a7563441d5d834757

const API_BASE = import.meta.env.VITE_CLOUD_API_URL ?? "http://localhost:4000";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Cloud API error (${response.status})`);
  }
  return (await response.json()) as T;
}

function applyAuthHeaders(headers: Headers) {
  const { token, selectedCompanyId, user } = useAuthStore.getState();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (user?.role === "ADMIN_GLOBAL" && selectedCompanyId) {
    headers.set("x-company-id", selectedCompanyId);
  }
}

async function authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  applyAuthHeaders(headers);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    useAuthStore.getState().clearSession();
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  return response;
}

export async function fetchCloudState(): Promise<CloudState> {
<<<<<<< HEAD
  if (isMockMode()) {
    return mockFetchCloudState();
  }
  
=======
>>>>>>> c1be563cc4fa16c77632d79a7563441d5d834757
  const response = await authorizedFetch(`${API_BASE}/state`);
  return handleResponse<CloudState>(response);
}

export async function persistCloudState(state: CloudState): Promise<void> {
<<<<<<< HEAD
  if (isMockMode()) {
    return mockPersistCloudState(state);
  }
  
=======
>>>>>>> c1be563cc4fa16c77632d79a7563441d5d834757
  await authorizedFetch(`${API_BASE}/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
}

export async function appendSyncEntry(entry: CloudState["syncHistory"][number]): Promise<void> {
<<<<<<< HEAD
  if (isMockMode()) {
    return mockAppendSyncEntry(entry);
  }
  
=======
>>>>>>> c1be563cc4fa16c77632d79a7563441d5d834757
  await authorizedFetch(`${API_BASE}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
}

export async function fetchActionPlans(): Promise<ActionPlan[]> {
<<<<<<< HEAD
  if (isMockMode()) {
    return mockFetchActionPlans();
  }
  
=======
>>>>>>> c1be563cc4fa16c77632d79a7563441d5d834757
  const response = await authorizedFetch(`${API_BASE}/action-plans`);
  return handleResponse<ActionPlan[]>(response);
}

export async function persistActionPlan(plan: ActionPlan): Promise<ActionPlan> {
<<<<<<< HEAD
  if (isMockMode()) {
    return mockPersistActionPlan(plan);
  }
  
=======
>>>>>>> c1be563cc4fa16c77632d79a7563441d5d834757
  const response = await authorizedFetch(`${API_BASE}/action-plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });
  return handleResponse<ActionPlan>(response);
}

export async function removeActionPlanApi(id: string): Promise<void> {
<<<<<<< HEAD
  if (isMockMode()) {
    return mockRemoveActionPlan(id);
  }
  
=======
>>>>>>> c1be563cc4fa16c77632d79a7563441d5d834757
  const response = await authorizedFetch(`${API_BASE}/action-plans/${id}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) {
    const message = await response.text();
    throw new Error(message || `Failed to remove plan (${response.status})`);
  }
}

