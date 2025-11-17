import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, X, Calendar, Video } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const Citas = () => {
  const [dateFilter, setDateFilter] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const queryClient = useQueryClient();

  // Fetch appointments
  const { data: appointments = [] } = useQuery({
    queryKey: ['vet-appointments', dateFilter],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select('*, pets(name, species), profiles!appointments_client_id_fkey(full_name)')
        .in('status', ['pendiente', 'confirmada'])
        .order('scheduled_for', { ascending: true });

      if (dateFilter) {
        query = query.gte('scheduled_for', dateFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Accept appointment
  const acceptMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const user = await supabase.auth.getUser();
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'confirmada',
          vet_id: user.data.user?.id,
        })
        .eq('id', appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cita aceptada');
      queryClient.invalidateQueries({ queryKey: ['vet-appointments'] });
    },
    onError: (error) => {
      toast.error('Error al aceptar cita: ' + error.message);
    },
  });

  // Cancel appointment
  const cancelMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelada' })
        .eq('id', appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cita cancelada');
      queryClient.invalidateQueries({ queryKey: ['vet-appointments'] });
    },
    onError: (error) => {
      toast.error('Error al cancelar cita: ' + error.message);
    },
  });

  // Complete appointment
  const completeMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'completada' })
        .eq('id', appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cita completada');
      setSelectedAppointment(null);
      queryClient.invalidateQueries({ queryKey: ['vet-appointments'] });
    },
    onError: (error) => {
      toast.error('Error al completar cita: ' + error.message);
    },
  });

  // Generate teleconference URL
  const generateTeleconferenceMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const url = `https://meet.vetcare360.app/${appointmentId}`;
      const { error } = await supabase
        .from('appointments')
        .update({ teleconference_url: url })
        .eq('id', appointmentId);

      if (error) throw error;
      return url;
    },
    onSuccess: (url) => {
      toast.success('URL de teleconsulta generada');
      queryClient.invalidateQueries({ queryKey: ['vet-appointments'] });
      window.open(url, '_blank');
    },
    onError: (error) => {
      toast.error('Error al generar URL: ' + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      pendiente: 'outline',
      confirmada: 'default',
      completada: 'secondary',
      cancelada: 'secondary',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-primary">Gestión de Citas</h1>
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-auto"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Citas Pendientes y Confirmadas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Mascota</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell>
                      {appointment.scheduled_for ? (
                        <div>
                          <div className="font-medium">
                            {format(new Date(appointment.scheduled_for), 'dd/MM/yyyy', { locale: es })}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(appointment.scheduled_for), 'HH:mm')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Por confirmar</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{(appointment.pets as any)?.name}</div>
                        <div className="text-sm text-muted-foreground">{(appointment.pets as any)?.species}</div>
                      </div>
                    </TableCell>
                    <TableCell>{(appointment.profiles as any)?.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{appointment.type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{appointment.reason}</TableCell>
                    <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {appointment.status === 'pendiente' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => acceptMutation.mutate(appointment.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        {appointment.status === 'confirmada' && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setSelectedAppointment(appointment)}
                            >
                              <Calendar className="h-4 w-4 mr-1" />
                              Completar
                            </Button>
                            {appointment.type === 'teleconsulta' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  appointment.teleconference_url
                                    ? window.open(appointment.teleconference_url, '_blank')
                                    : generateTeleconferenceMutation.mutate(appointment.id)
                                }
                              >
                                <Video className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => cancelMutation.mutate(appointment.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Completar Cita</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>¿Deseas marcar esta cita como completada?</p>
              {selectedAppointment && (
                <div className="space-y-2 text-sm">
                  <p><strong>Mascota:</strong> {(selectedAppointment.pets as any)?.name}</p>
                  <p><strong>Cliente:</strong> {(selectedAppointment.profiles as any)?.full_name}</p>
                  <p><strong>Motivo:</strong> {selectedAppointment.reason}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => completeMutation.mutate(selectedAppointment?.id)}
                >
                  Completar Cita
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => setSelectedAppointment(null)}
                >
                  Cancelar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Sugerencia: Después de completar, puedes crear una entrada clínica en Historias Clínicas.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Citas;
