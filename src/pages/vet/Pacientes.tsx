import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserPlus, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Pacientes = () => {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    password: '',
  });
  const queryClient = useQueryClient();

  // Fetch clients with pets
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-with-pets'],
    queryFn: async () => {
      // First get client user_ids
      const { data: clientRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'client');
      
      if (rolesError) throw rolesError;
      if (!clientRoles || clientRoles.length === 0) return [];

      const clientIds = clientRoles.map(r => r.user_id);

      // Then get profiles with pets
      const { data, error } = await supabase
        .from('profiles')
        .select('*, pets(*)')
        .in('id', clientIds);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch pets for selected client
  const { data: clientPets = [] } = useQuery({
    queryKey: ['client-pets', selectedClient],
    queryFn: async () => {
      if (!selectedClient) return [];
      const { data, error } = await supabase
        .from('pets')
        .select('*, clinical_records(*)')
        .eq('owner_id', selectedClient);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient,
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (formData: typeof clientForm) => {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            phone: formData.phone,
            role: 'client',
          },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (authError) throw authError;
      return authData;
    },
    onSuccess: () => {
      toast.success('Cliente creado exitosamente');
      setClientForm({ email: '', full_name: '', phone: '', password: '' });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['clients-with-pets'] });
    },
    onError: (error: any) => {
      toast.error('Error al crear cliente: ' + error.message);
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-primary">Pacientes</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Crear Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Cliente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="client-name">Nombre Completo</Label>
                  <Input
                    id="client-name"
                    value={clientForm.full_name}
                    onChange={(e) => setClientForm({ ...clientForm, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="client-email">Email</Label>
                  <Input
                    id="client-email"
                    type="email"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="client-phone">Teléfono</Label>
                  <Input
                    id="client-phone"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="client-password">Contraseña</Label>
                  <Input
                    id="client-password"
                    type="password"
                    value={clientForm.password}
                    onChange={(e) => setClientForm({ ...clientForm, password: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createClientMutation.mutate(clientForm)}
                  disabled={createClientMutation.isPending}
                >
                  Crear Cliente
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="clientes" className="w-full">
          <TabsList>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="mascotas">Todas las Mascotas</TabsTrigger>
          </TabsList>

          <TabsContent value="clientes">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Clientes</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Mascotas</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => {
                      const pets = Array.isArray(client.pets) ? client.pets : [];
                      return (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">{client.full_name}</TableCell>
                          <TableCell>{client.phone || 'N/A'}</TableCell>
                          <TableCell>{pets.length}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedClient(client.id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver Mascotas
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {selectedClient && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Mascotas del Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                  {clientPets.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Este cliente no tiene mascotas registradas
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Especie</TableHead>
                          <TableHead>Raza</TableHead>
                          <TableHead>Edad</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientPets.map((pet) => (
                          <TableRow key={pet.id}>
                            <TableCell className="font-medium">{pet.name}</TableCell>
                            <TableCell>{pet.species}</TableCell>
                            <TableCell>{pet.breed || 'N/A'}</TableCell>
                            <TableCell>
                              {pet.birth_date
                                ? `${Math.floor((new Date().getTime() - new Date(pet.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 365))} años`
                                : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => navigate('/vet/historias-clinicas', { state: { petId: pet.id, petName: pet.name } })}
                              >
                                Ver Historia
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="mascotas">
            <Card>
              <CardHeader>
                <CardTitle>Todas las Mascotas</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Especie</TableHead>
                      <TableHead>Dueño</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.flatMap((client) => {
                      const pets = Array.isArray(client.pets) ? client.pets : [];
                      return pets.map((pet: any) => (
                        <TableRow key={pet.id}>
                          <TableCell className="font-medium">{pet.name}</TableCell>
                          <TableCell>{pet.species}</TableCell>
                          <TableCell>{client.full_name}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              Ver Detalle
                            </Button>
                          </TableCell>
                        </TableRow>
                      ));
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Pacientes;
