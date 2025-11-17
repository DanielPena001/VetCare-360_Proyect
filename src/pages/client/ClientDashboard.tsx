import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PawPrint, Calendar, ShoppingBag, CheckCircle2, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Número de mascotas
  const { data: petsCount } = useQuery({
    queryKey: ['client-pets-count', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('pets')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user?.id);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id
  });

  // Citas futuras
  const { data: futureAppointmentsCount } = useQuery({
    queryKey: ['client-future-appointments-count', user?.id],
    queryFn: async () => {
      const now = new Date();

      const { count, error } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', user?.id)
        .in('status', ['pendiente', 'confirmada'])
        .gt('scheduled_for', now.toISOString());

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id
  });

  // Citas completadas
  const { data: completedAppointmentsCount } = useQuery({
    queryKey: ['client-completed-appointments', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', user?.id)
        .eq('status', 'completada');

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id
  });

  // Número de compras
  const { data: purchasesCount } = useQuery({
    queryKey: ['client-purchases-count', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', user?.id);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id
  });

  // Próximas citas
  const { data: upcomingAppointments } = useQuery({
    queryKey: ['client-upcoming-appointments', user?.id],
    queryFn: async () => {
      const now = new Date();

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          pets (name, species),
          profiles!appointments_vet_id_fkey (full_name)
        `)
        .eq('client_id', user?.id)
        .in('status', ['pendiente', 'confirmada'])
        .gt('scheduled_for', now.toISOString())
        .order('scheduled_for')
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Últimas compras
  const { data: recentPurchases } = useQuery({
    queryKey: ['client-recent-purchases', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('id, total, created_at, payment_status')
        .eq('customer_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Panel de Cliente</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona tus mascotas, citas y compras
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Mis Mascotas"
            value={petsCount || 0}
            icon={PawPrint}
            description="Mascotas registradas"
          />
          <StatCard
            title="Citas Futuras"
            value={futureAppointmentsCount || 0}
            icon={Calendar}
            description="Pendientes y confirmadas"
          />
          <StatCard
            title="Citas Completadas"
            value={completedAppointmentsCount || 0}
            icon={CheckCircle2}
            description="Historial de consultas"
          />
          <StatCard
            title="Compras Realizadas"
            value={purchasesCount || 0}
            icon={ShoppingBag}
            description="Total de pedidos"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Button onClick={() => navigate('/client/mascotas')} variant="outline" className="h-20">
            <PawPrint className="mr-2 h-5 w-5" />
            <span className="text-lg">Mis Mascotas</span>
          </Button>
          <Button onClick={() => navigate('/client/citas')} variant="outline" className="h-20">
            <Calendar className="mr-2 h-5 w-5" />
            <span className="text-lg">Mis Citas</span>
          </Button>
          <Button onClick={() => navigate('/client/mercadito')} variant="outline" className="h-20">
            <ShoppingBag className="mr-2 h-5 w-5" />
            <span className="text-lg">Mercadito</span>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Próximas Citas</CardTitle>
              <CardDescription>Tus citas programadas</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingAppointments && upcomingAppointments.length > 0 ? (
                <div className="space-y-4">
                  {upcomingAppointments.map((apt) => (
                    <div key={apt.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{(apt.pets as any)?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {apt.scheduled_for 
                              ? format(new Date(apt.scheduled_for), "dd/MM/yyyy HH:mm", { locale: es })
                              : 'Por agendar'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Dr. {(apt.profiles as any)?.full_name || 'Por asignar'}
                          </p>
                        </div>
                        <Badge variant={apt.status === 'confirmada' ? 'default' : 'secondary'}>
                          {apt.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="capitalize">{apt.type}</span>
                        {apt.type === 'teleconsulta' && apt.status === 'confirmada' && apt.teleconference_url && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => window.open(apt.teleconference_url!, '_blank')}
                          >
                            <Video className="h-4 w-4 mr-1" />
                            Entrar a Teleconsulta
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No tienes citas programadas</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Últimas Compras</CardTitle>
              <CardDescription>Historial de pedidos</CardDescription>
            </CardHeader>
            <CardContent>
              {recentPurchases && recentPurchases.length > 0 ? (
                <div className="space-y-4">
                  {recentPurchases.map((purchase) => (
                    <div key={purchase.id} className="flex justify-between items-center border-b pb-3 last:border-0">
                      <div>
                        <p className="font-medium">
                          ${Number(purchase.total).toLocaleString('es-CO')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(purchase.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={purchase.payment_status === 'paid' ? 'default' : 'secondary'}>
                          {purchase.payment_status === 'paid' ? 'Pagado' : 'Pendiente'}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => navigate('/client/compras')}>
                          Ver detalle
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No tienes compras registradas</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ClientDashboard;
