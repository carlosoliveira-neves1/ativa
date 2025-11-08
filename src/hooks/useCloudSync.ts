import { useEffect, useRef } from "react";
import { persistCloudState } from "../services/cloudClient";
import { useQuestionnaireStore } from "../store/useQuestionnaireStore";

const SYNC_DEBOUNCE_MS = 800;

export function useCloudSync() {
  const responses = useQuestionnaireStore((state) => state.responses);
  const syncHistory = useQuestionnaireStore((state) => state.syncHistory);
  const actionPlans = useQuestionnaireStore((state) => state.actionPlans);
  const conditionalRules = useQuestionnaireStore((state) => state.conditionalRules);
  const isHydrated = useQuestionnaireStore((state) => state.isHydrated);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPayloadRef = useRef<string>("");

  useEffect(() => {
    if (!isHydrated) return;

    const payload = JSON.stringify({ responses, syncHistory, actionPlans, conditionalRules });
    if (payload === lastPayloadRef.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        await persistCloudState({ responses, syncHistory, actionPlans, conditionalRules });
        lastPayloadRef.current = payload;
      } catch (error) {
        console.warn("Falha ao salvar dados na nuvem local", error);
      }
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [responses, syncHistory, actionPlans, conditionalRules, isHydrated]);
}
