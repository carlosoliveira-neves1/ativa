import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { QuestionnairesPage } from "./pages/QuestionnairesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ActionPlansPage } from "./pages/ActionPlansPage";
import { UsersPage } from "./pages/UsersPage";
import { ProfilePage } from "./pages/ProfilePage";
import { TrainingPage } from "./pages/TrainingPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { QuestionnaireTokenPage } from "./pages/QuestionnaireTokenPage";
import { AuthGate } from "./components/auth/AuthGate";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/questionnaire/token/:token" element={<QuestionnaireTokenPage />} />
        <Route element={<AuthGate />}> 
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/questionarios" element={<QuestionnairesPage />} />
            <Route path="/relatorios" element={<ReportsPage />} />
            <Route path="/planos" element={<ActionPlansPage />} />
            <Route path="/usuarios" element={<UsersPage />} />
            <Route path="/treinamentos" element={<TrainingPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
