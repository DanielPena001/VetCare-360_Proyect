import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type AppRole = 'admin' | 'vet' | 'client';

interface UserProfile {
  id: string;
  full_name: string;
  phone: string | null;
  role: AppRole;
}

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (authLoading) return;
      
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        // Cargar perfil
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        // Cargar rol desde user_roles
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (roleError) throw roleError;

        const mappedProfile: UserProfile = {
          id: profileData.id,
          full_name: profileData.full_name,
          phone: profileData.phone,
          role: roleData.role as AppRole,
        };

        setProfile(mappedProfile);
        setError(null);
      } catch (err) {
        console.error('Error loading user profile:', err);
        setError('Error al cargar el perfil de usuario');
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [user, authLoading]);

  const hasRole = (role: AppRole): boolean => {
    return profile?.role === role;
  };

  const getPrimaryRole = (): AppRole | null => {
    return profile?.role ?? null;
  };

  const getDashboardPath = (): string => {
    const primaryRole = getPrimaryRole();
    
    switch (primaryRole) {
      case 'admin':
        return '/admin/dashboard';
      case 'vet':
        return '/vet/dashboard';
      case 'client':
        return '/client/dashboard';
      default:
        return '/auth';
    }
  };

  return {
    profile,
    loading: authLoading || loading,
    error,
    hasRole,
    getPrimaryRole,
    getDashboardPath,
  };
};
