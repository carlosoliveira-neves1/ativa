import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { QuestionnairesPage } from "./pages/QuestionnairesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ActionPlansPage } from "./pages/ActionPlansPage";
import { LoginPage } from "./pages/LoginPage";
import { AuthGate } from "./components/auth/AuthGate";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AuthGate />}> 
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/questionarios" element={<QuestionnairesPage />} />
            <Route path="/relatorios" element={<ReportsPage />} />
            <Route path="/planos" element={<ActionPlansPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
