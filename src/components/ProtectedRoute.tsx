import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

type AppRole = 'admin' | 'vet' | 'client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, getDashboardPath } = useUserRole();
  const navigate = useNavigate();

  const loading = authLoading || profileLoading;

  useEffect(() => {
    if (!loading && user && profile) {
      const userHasRole = allowedRoles.includes(profile.role);
      
      if (!userHasRole) {
        // Redirigir al dashboard correspondiente
        navigate(getDashboardPath(), { replace: true });
      }
    }
  }, [loading, user, profile, allowedRoles, getDashboardPath, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-xl text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-xl text-destructive">Error al cargar el perfil</p>
        </div>
      </div>
    );
  }

  const userHasRole = allowedRoles.includes(profile.role);

  if (!userHasRole) {
    return null; // El useEffect ya manejará la redirección
  }

  return <>{children}</>;
};
