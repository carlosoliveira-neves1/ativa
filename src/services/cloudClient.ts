import type { CloudState } from "../store/useQuestionnaireStore";

const API_BASE = import.meta.env.VITE_CLOUD_API_URL ?? "http://localhost:4000";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Cloud API error (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function fetchCloudState(): Promise<CloudState> {
  const response = await fetch(`${API_BASE}/state`);
  return handleResponse<CloudState>(response);
}

export async function persistCloudState(state: CloudState): Promise<void> {
  await fetch(`${API_BASE}/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
}

export async function appendSyncEntry(entry: CloudState["syncHistory"][number]): Promise<void> {
  await fetch(`${API_BASE}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
}
