import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { fetchProfile } from "../../services/authClient";
import { useAuthStore } from "../../store/useAuthStore";
import { resetQuestionnaireState } from "../../store/useQuestionnaireStore";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3 text-slate-600">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary/40 border-t-transparent" />
        <p className="text-sm font-medium">Carregando sessão...</p>
      </div>
    </div>
  );
}

export function AuthGate() {
  const location = useLocation();
  const { token, user, status, error, setStatus, setError, setSession, clearSession } =
    useAuthStore((state) => ({
      token: state.token,
      user: state.user,
      status: state.status,
      error: state.error,
      setStatus: state.setStatus,
      setError: state.setError,
      setSession: state.setSession,
      clearSession: state.clearSession,
    }));

  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  useEffect(() => {
    if (!token) {
      resetQuestionnaireState();
      setStatus("idle");
      setError(null);
      return;
    }

    if (status === "idle" || (status === "error" && !user)) {
      setStatus("loading");
      fetchProfile()
        .then((profile) => {
          setSession(token, profile.user, selectedCompanyId ?? profile.user.company?.id ?? null);
          setStatus("authenticated");
        })
        .catch((err) => {
          console.warn("Falha ao validar sessão", err);
          clearSession();
          setError("Sessão expirada. Faça login novamente.");
        });
    }
  }, [token, status, user, selectedCompanyId, setSession, setStatus, setError, clearSession]);

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (status === "loading" || !user) {
    return <LoadingScreen />;
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg">
          <h1 className="text-lg font-semibold text-red-600">Não foi possível validar sua sessão</h1>
          <p className="mt-3 text-sm text-slate-600">{error ?? "Tente novamente em instantes."}</p>
          <button
            type="button"
            onClick={() => {
              clearSession();
            }}
            className="mt-6 w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            Fazer login novamente
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
