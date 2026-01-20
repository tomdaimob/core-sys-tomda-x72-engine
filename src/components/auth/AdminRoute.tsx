import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { toast } from 'sonner';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, loading, isAdmin } = useAuth();
  
  useEffect(() => {
    if (!loading && user && !isAdmin) {
      toast.error('Acesso restrito', {
        description: 'Você não tem permissão para acessar esta página.',
      });
    }
  }, [loading, user, isAdmin]);

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

  if (!isAdmin) {
    return <Navigate to="/orcamentos" replace />;
  }
  
  return <>{children}</>;
}
