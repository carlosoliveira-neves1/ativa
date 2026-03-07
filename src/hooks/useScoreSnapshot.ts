import { useEffect, useMemo } from "react";
import { questionnaire } from "../config/questionnaire";
import { calculateScoreSnapshot } from "../utils/scoring";
import {
  useQuestionnaireStore,
  type CloudState,
} from "../store/useQuestionnaireStore";
import { fetchCloudState } from "../services/cloudClient";

function useHydrateCloud() {
  const hydrate = useQuestionnaireStore((state) => state.hydrate);
  const isHydrated = useQuestionnaireStore((state) => state.isHydrated);

  useEffect(() => {
    if (isHydrated) return;
    let cancelled = false;

    const load = async () => {
      try {
        const cloudState = await fetchCloudState();
        if (!cancelled) {
          hydrate(cloudState satisfies CloudState);
        }
      } catch (error) {
        console.warn("Falha ao sincronizar com nuvem local", error);
        if (!cancelled) {
          hydrate({ responses: {}, syncHistory: [], actionPlans: [], conditionalRules: [] });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [hydrate, isHydrated]);
}

export function useScoreSnapshot() {
  useHydrateCloud();

  const responses = useQuestionnaireStore((state) => state.responses);
  const syncHistory = useQuestionnaireStore((state) => state.syncHistory);

  return useMemo(
    () => calculateScoreSnapshot(questionnaire, responses, syncHistory),
    [responses, syncHistory]
  );
}
