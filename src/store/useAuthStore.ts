import { create } from "zustand";
import type { AuthUser } from "../services/authClient";

const SESSION_STORAGE_KEY = "ativa_auth_session";

interface SessionData {
  token: string;
  user: AuthUser;
  selectedCompanyId: string | null;
}

function loadSession(): SessionData | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as SessionData;
    if (typeof parsed.token !== "string" || !parsed.user) {
      return null;
    }
    return {
      token: parsed.token,
      user: parsed.user,
      selectedCompanyId: parsed.selectedCompanyId ?? parsed.user.company?.id ?? null,
    };
  } catch (error) {
    console.warn("Falha ao carregar sessão", error);
    return null;
  }
}

function saveSession(data: SessionData | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (!data) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  selectedCompanyId: string | null;
  status: "idle" | "loading" | "authenticated" | "error";
  error: string | null;
  setSession: (token: string, user: AuthUser, selectedCompanyId?: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  setStatus: (status: AuthState["status"]) => void;
  setError: (message: string | null) => void;
  setSelectedCompanyId: (companyId: string | null) => void;
  clearSession: () => void;
}

const initialSession = loadSession();

export const useAuthStore = create<AuthState>((set, get) => ({
  token: initialSession?.token ?? null,
  user: initialSession?.user ?? null,
  selectedCompanyId:
    initialSession?.selectedCompanyId ?? initialSession?.user?.company?.id ?? null,
  status: initialSession?.token ? "idle" : "idle",
  error: null,
  setSession: (token, user, selectedCompanyId = user.company?.id ?? null) => {
    set({ token, user, selectedCompanyId, status: "authenticated", error: null });
    saveSession({ token, user, selectedCompanyId });
  },
  setUser: (user) => {
    set({ user });
    const state = get();
    if (state.token && user) {
      saveSession({ token: state.token, user, selectedCompanyId: state.selectedCompanyId });
    }
  },
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setSelectedCompanyId: (selectedCompanyId) => {
    set({ selectedCompanyId });
    const state = get();
    if (state.token && state.user) {
      saveSession({ token: state.token, user: state.user, selectedCompanyId });
    }
  },
  clearSession: () => {
    saveSession(null);
    set({ token: null, user: null, selectedCompanyId: null, status: "idle", error: null });
  },
}));
