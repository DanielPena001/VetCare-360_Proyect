import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Calendar, Plus, Video, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const CitasCliente = () => {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    pet_id: '',
    type: 'presencial',
    reason: '',
    scheduled_for: '',
  });
  const queryClient = useQueryClient();

  // Fetch user's pets
  const { data: pets = [] } = useQuery({
    queryKey: ['my-pets-for-appointments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pets')
        .select('id, name, species')
        .eq('owner_id', user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch user's appointments
  const { data: appointments = [] } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, pets(name, species)')
        .eq('client_id', user?.id)
        .order('scheduled_for', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (formData: typeof appointmentForm) => {
      const { error } = await supabase.from('appointments').insert({
        client_id: user?.id,
        pet_id: formData.pet_id,
        type: formData.type,
        reason: formData.reason,
        status: 'pendiente',
        requested_at: new Date().toISOString(),
        scheduled_for: formData.scheduled_for || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cita solicitada exitosamente. Te contactaremos pronto para confirmar.');
      setAppointmentForm({
        pet_id: '',
        type: 'presencial',
        reason: '',
        scheduled_for: '',
      });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
    },
    onError: (error: any) => {
      toast.error('Error al solicitar cita: ' + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const config = {
      pendiente: { variant: 'outline' as const, label: 'Pendiente', color: 'text-yellow-600' },
      confirmada: { variant: 'default' as const, label: 'Confirmada', color: 'text-green-600' },
      completada: { variant: 'secondary' as const, label: 'Completada', color: 'text-blue-600' },
      cancelada: { variant: 'destructive' as const, label: 'Cancelada', color: 'text-red-600' },
    };
    const cfg = config[status as keyof typeof config] || config.pendiente;
    return <Badge variant={cfg.variant} className={cfg.color}>{cfg.label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">Mis Citas</h1>
            <p className="text-muted-foreground mt-2">Gestiona las citas veterinarias de tus mascotas</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary">
                <Plus className="mr-2 h-4 w-4" />
                Solicitar Cita
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nueva Solicitud de Cita</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="pet">Mascota *</Label>
                  <Select
                    value={appointmentForm.pet_id}
                    onValueChange={(value) => setAppointmentForm({ ...appointmentForm, pet_id: value })}
                  >
                    <SelectTrigger id="pet">
                      <SelectValue placeholder="Selecciona una mascota" />
                    </SelectTrigger>
                    <SelectContent>
                      {pets.map((pet) => (
                        <SelectItem key={pet.id} value={pet.id}>
                          {pet.name} ({pet.species})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="type">Tipo de Cita *</Label>
                  <Select
                    value={appointmentForm.type}
                    onValueChange={(value) => setAppointmentForm({ ...appointmentForm, type: value })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presencial">Presencial</SelectItem>
                      <SelectItem value="teleconsulta">Teleconsulta</SelectItem>
                    </SelectContent>
                  </Select>
                  {appointmentForm.type === 'teleconsulta' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Recibirás un enlace de videollamada una vez confirmada la cita
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="reason">Motivo de la Consulta *</Label>
                  <Textarea
                    id="reason"
                    placeholder="Describe el motivo de la cita..."
                    value={appointmentForm.reason}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, reason: e.target.value })}
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="scheduled_for">Fecha y Hora Preferida</Label>
                  <Input
                    id="scheduled_for"
                    type="datetime-local"
                    value={appointmentForm.scheduled_for}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, scheduled_for: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Fecha sugerida. Nos contactaremos para confirmar disponibilidad.
                  </p>
                </div>

                <Button
                  className="w-full gradient-primary"
                  onClick={() => createAppointmentMutation.mutate(appointmentForm)}
                  disabled={createAppointmentMutation.isPending || !appointmentForm.pet_id || !appointmentForm.reason}
                >
                  Solicitar Cita
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {pets.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="h-24 w-24 text-muted-foreground mx-auto mb-6 opacity-50" />
            <h3 className="text-2xl font-semibold mb-2">Primero registra una mascota</h3>
            <p className="text-muted-foreground mb-6">
              Para solicitar una cita, primero debes tener al menos una mascota registrada
            </p>
            <Button onClick={() => window.location.href = '/client/mascotas'}>
              Ir a Mis Mascotas
            </Button>
          </Card>
        ) : appointments.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="h-24 w-24 text-muted-foreground mx-auto mb-6 opacity-50" />
            <h3 className="text-2xl font-semibold mb-2">No tienes citas programadas</h3>
            <p className="text-muted-foreground mb-6">
              Solicita tu primera cita para comenzar a cuidar la salud de tu mascota
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="gradient-primary">
              <Plus className="mr-2 h-4 w-4" />
              Solicitar Primera Cita
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment) => {
              const pet = appointment.pets as any;
              return (
                <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          {pet?.name}
                          {appointment.type === 'teleconsulta' && (
                            <Video className="h-5 w-5 text-primary" />
                          )}
                        </CardTitle>
                        <CardDescription className="text-base mt-1">
                          {pet?.species} • {appointment.type === 'teleconsulta' ? 'Teleconsulta' : 'Presencial'}
                        </CardDescription>
                      </div>
                      {getStatusBadge(appointment.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Motivo:</p>
                      <p className="text-muted-foreground">{appointment.reason}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-2">
                        <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">
                            {appointment.scheduled_for
                              ? format(new Date(appointment.scheduled_for), "dd 'de' MMMM, yyyy", { locale: es })
                              : 'Por confirmar'}
                          </p>
                          {appointment.scheduled_for && (
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(appointment.scheduled_for), 'HH:mm')}
                            </p>
                          )}
                        </div>
                      </div>

                      {appointment.type === 'presencial' && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">VetCare 360</p>
                            <p className="text-sm text-muted-foreground">Av. Principal 123</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {appointment.status === 'confirmada' && appointment.type === 'teleconsulta' && appointment.teleconference_url && (
                      <Button
                        className="w-full gradient-primary"
                        onClick={() => window.open(appointment.teleconference_url!, '_blank')}
                      >
                        <Video className="mr-2 h-4 w-4" />
                        Iniciar Teleconsulta
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CitasCliente;
