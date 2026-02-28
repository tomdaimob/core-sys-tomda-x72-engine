import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AdminRoute } from "./components/auth/AdminRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orcamentos from "./pages/Orcamentos";
import NovoOrcamento from "./pages/NovoOrcamento";
import Configuracoes from "./pages/Configuracoes";
import Precos from "./pages/Precos";
import Usuarios from "./pages/Usuarios";
import Aprovacoes from "./pages/Aprovacoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/orcamentos" element={<ProtectedRoute><Orcamentos /></ProtectedRoute>} />
      <Route path="/orcamentos/novo" element={<ProtectedRoute><NovoOrcamento key="novo" /></ProtectedRoute>} />
      <Route path="/orcamentos/:id" element={<ProtectedRoute><NovoOrcamento key="edit" /></ProtectedRoute>} />
      <Route path="/aprovacoes" element={<AdminRoute><Aprovacoes /></AdminRoute>} />
      <Route path="/precos" element={<AdminRoute><Precos /></AdminRoute>} />
      <Route path="/usuarios" element={<AdminRoute><Usuarios /></AdminRoute>} />
      <Route path="/configuracoes" element={<AdminRoute><Configuracoes /></AdminRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
