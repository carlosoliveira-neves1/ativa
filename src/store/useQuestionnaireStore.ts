import { create } from "zustand";

export interface QuestionResponse {
  value?: string | number;
  attachmentName?: string;
  attachmentData?: string;
}

export type SectionResponses = Record<string, QuestionResponse>;
export type QuestionnaireResponses = Record<string, SectionResponses>;

export interface SyncEntry {
  timestamp: string;
  conformity: number;
  completion: number;
  note?: string;
}

export type ActionPlanSeverity = "Crítica" | "Alta" | "Média" | "Baixa";
export type ActionPlanStatus = "Pendente" | "Em andamento" | "Concluído" | "Atrasado";

export interface ActionPlan {
  id: string;
  title: string;
  problemDescription: string;
  normativeItem: string;
  unitOrSector: string;
  correctiveAction: string;
  severity: ActionPlanSeverity;
  status: ActionPlanStatus;
  dueDate: string;
  responsible: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudState {
  responses: QuestionnaireResponses;
  syncHistory: SyncEntry[];
  actionPlans: ActionPlan[];
}

interface QuestionnaireState extends CloudState {
  isHydrated: boolean;
  updateResponse: (
    sectionId: string,
    questionId: string,
    response: Partial<QuestionResponse>
  ) => void;
  clearResponse: (sectionId: string, questionId: string) => void;
  clearSection: (sectionId: string) => void;
  registerSync: (entry: SyncEntry) => void;
  resetAll: () => void;
  hydrate: (state: CloudState) => void;
  setActionPlans: (plans: ActionPlan[]) => void;
  upsertActionPlan: (plan: ActionPlan) => void;
  removeActionPlan: (id: string) => void;
}

const defaultState: QuestionnaireState = {
  responses: {},
  syncHistory: [],
  actionPlans: [],
  isHydrated: false,
  updateResponse: () => undefined,
  clearResponse: () => undefined,
  clearSection: () => undefined,
  registerSync: () => undefined,
  resetAll: () => undefined,
  hydrate: () => undefined,
  setActionPlans: () => undefined,
  upsertActionPlan: () => undefined,
  removeActionPlan: () => undefined,
};

export const useQuestionnaireStore = create<QuestionnaireState>((set) => ({
  ...defaultState,
  updateResponse: (sectionId, questionId, response) =>
    set((state) => {
      const section = state.responses[sectionId] ?? {};
      const previous = section[questionId] ?? {};
      return {
        responses: {
          ...state.responses,
          [sectionId]: {
            ...section,
            [questionId]: { ...previous, ...response },
          },
        },
      };
    }),
  clearResponse: (sectionId, questionId) =>
    set((state) => {
      const section = state.responses[sectionId];
      if (!section) {
        return state;
      }
      const { [questionId]: _removed, ...rest } = section;
      return {
        responses: {
          ...state.responses,
          [sectionId]: rest,
        },
      };
    }),
  clearSection: (sectionId) =>
    set((state) => {
      const { [sectionId]: _removed, ...rest } = state.responses;
      return { responses: rest };
    }),
  registerSync: (entry) =>
    set((state) => ({
      syncHistory: [entry, ...state.syncHistory].slice(0, 12),
    })),
  resetAll: () =>
    set((state) => ({
      responses: {},
      syncHistory: [],
      actionPlans: state.actionPlans,
      isHydrated: state.isHydrated,
    })),
  hydrate: (cloudState) =>
    set(() => ({
      responses: cloudState.responses ?? {},
      syncHistory: cloudState.syncHistory ?? [],
      actionPlans: cloudState.actionPlans ?? [],
      isHydrated: true,
    })),
  setActionPlans: (plans) => set({ actionPlans: plans }),
  upsertActionPlan: (plan) =>
    set((state) => {
      const index = state.actionPlans.findIndex((item) => item.id === plan.id);
      const actionPlans = [...state.actionPlans];
      if (index >= 0) {
        actionPlans[index] = plan;
      } else {
        actionPlans.unshift(plan);
      }
      return { actionPlans };
    }),
  removeActionPlan: (id) =>
    set((state) => ({
      actionPlans: state.actionPlans.filter((plan) => plan.id !== id),
    })),
}));
