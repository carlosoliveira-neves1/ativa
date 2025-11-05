import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

interface TokenResponse {
  user: {
    id: string;
    name: string;
    email: string;
  };
  company: {
    id: string;
    code: string;
    nomeFantasia: string;
    razaoSocial: string;
  };
  token: string;
}

export function QuestionnaireTokenPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Token não fornecido");
      setLoading(false);
      return;
    }

    const validateToken = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/questionnaire/token/${token}`);
        
        if (response.ok) {
          const data: TokenResponse = await response.json();
          
          // Salvar usuário e token no store
          setSession(data.token, {
            id: data.user.id,
            name: data.user.name,
            login: data.user.email, // Usar email como login para acesso via token
            email: data.user.email,
            role: "USER",
            company: {
              id: data.company.id,
              code: data.company.code,
              nomeFantasia: data.company.nomeFantasia,
              razaoSocial: data.company.razaoSocial,
              cnpj: "",
            },
          });
          
          setSuccess(true);
          
          // Redirecionar para página do questionário após 2 segundos
          setTimeout(() => {
            navigate("/questionarios");
          }, 2000);
        } else {
          const errorData = await response.json();
          setError(errorData.message || "Token inválido");
        }
      } catch (err) {
        setError("Erro ao validar token. Tente novamente.");
        console.error("Token validation error:", err);
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token, navigate, setSession]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <h2 className="mt-4 text-lg font-semibold text-slate-800">Validando acesso...</h2>
          <p className="mt-2 text-sm text-slate-600">Estamos preparando seu questionário.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-lg font-semibold text-slate-800">Acesso não autorizado</h2>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <p className="mt-4 text-xs text-slate-500">
            Verifique o link no email ou entre em contato com o administrador.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <h2 className="mt-4 text-lg font-semibold text-slate-800">Acesso autorizado!</h2>
          <p className="mt-2 text-sm text-slate-600">
            Você será redirecionado para o questionário em instantes...
          </p>
          <div className="mt-4">
            <div className="mx-auto h-2 w-32 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full animate-pulse bg-green-500"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
