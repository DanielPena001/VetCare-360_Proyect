import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserPlus, Users } from 'lucide-react';

const Usuarios = () => {
  const [isVetDialogOpen, setIsVetDialogOpen] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const [vetForm, setVetForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    password: '',
  });

  const [clientForm, setClientForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    password: '',
  });

  // Fetch all users
  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) return [];

      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) throw rolesError;

      // Merge profiles with their roles
      return profiles.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          ...profile,
          user_roles: userRole ? [userRole] : []
        };
      });
    },
  });

  // Create veterinarian
  const createVetMutation = useMutation({
    mutationFn: async (formData: typeof vetForm) => {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            phone: formData.phone,
            role: 'vet',
          },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (authError) throw authError;
      return authData;
    },
    onSuccess: () => {
      toast.success('Veterinario creado exitosamente');
      setVetForm({ email: '', full_name: '', phone: '', password: '' });
      setIsVetDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    },
    onError: (error: any) => {
      toast.error('Error al crear veterinario: ' + error.message);
    },
  });

  // Create client
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
      setIsClientDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    },
    onError: (error: any) => {
      toast.error('Error al crear cliente: ' + error.message);
    },
  });

  const getRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      admin: 'default',
      vet: 'secondary',
      client: 'outline',
    };
    return (
      <Badge variant={variants[role] || 'outline'}>
        {role === 'admin' ? 'Administrador' : role === 'vet' ? 'Veterinario' : 'Cliente'}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-primary">Gestión de Usuarios</h1>
          <div className="flex gap-2">
            <Dialog open={isVetDialogOpen} onOpenChange={setIsVetDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Crear Veterinario
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Veterinario</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="vet-name">Nombre Completo</Label>
                    <Input
                      id="vet-name"
                      value={vetForm.full_name}
                      onChange={(e) => setVetForm({ ...vetForm, full_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="vet-email">Email</Label>
                    <Input
                      id="vet-email"
                      type="email"
                      value={vetForm.email}
                      onChange={(e) => setVetForm({ ...vetForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="vet-phone">Teléfono</Label>
                    <Input
                      id="vet-phone"
                      value={vetForm.phone}
                      onChange={(e) => setVetForm({ ...vetForm, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="vet-password">Contraseña</Label>
                    <Input
                      id="vet-password"
                      type="password"
                      value={vetForm.password}
                      onChange={(e) => setVetForm({ ...vetForm, password: e.target.value })}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createVetMutation.mutate(vetForm)}
                    disabled={createVetMutation.isPending}
                  >
                    Crear Veterinario
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Users className="mr-2 h-4 w-4" />
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Todos los Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const userRoles = user.user_roles as any;
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.phone || 'N/A'}</TableCell>
                      <TableCell>
                        {Array.isArray(userRoles) && userRoles[0]?.role && getRoleBadge(userRoles[0].role)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Usuarios;
