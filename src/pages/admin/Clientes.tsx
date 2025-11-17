import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Users, PawPrint, Calendar, ShoppingCart, Eye, TrendingUp, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ClientStats {
  client_id: string;
  full_name: string;
  email: string;
  phone: string;
  pets_count: number;
  appointments_count: number;
  total_spent: number;
  created_at: string;
}

const Clientes = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientStats | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch clients with stats
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['admin-clients', searchTerm],
    queryFn: async () => {
      // Get all clients
      const { data: clientRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'client');

      if (rolesError) throw rolesError;

      const clientIds = clientRoles.map(r => r.user_id);

      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', clientIds);

      if (profilesError) throw profilesError;

      // Get stats for each client
      const clientsWithStats = await Promise.all(
        profiles.map(async (profile) => {
          // Count pets
          const { count: petsCount } = await supabase
            .from('pets')
            .select('*', { count: 'exact', head: true })
            .eq('owner_id', profile.id);

          // Count appointments
          const { count: appointmentsCount } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', profile.id);

          // Sum total spent
          const { data: sales } = await supabase
            .from('sales')
            .select('total')
            .eq('customer_id', profile.id);

          const totalSpent = sales?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0;

          // Get user email from auth (we'll use a placeholder since we can't query auth.users directly)
          const email = `${profile.full_name.toLowerCase().replace(/\s+/g, '.')}@example.com`;

          return {
            client_id: profile.id,
            full_name: profile.full_name,
            email,
            phone: profile.phone || 'No registrado',
            pets_count: petsCount || 0,
            appointments_count: appointmentsCount || 0,
            total_spent: totalSpent,
            created_at: profile.created_at,
          };
        })
      );

      // Filter by search term
      if (searchTerm) {
        return clientsWithStats.filter(client =>
          client.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.phone.includes(searchTerm)
        );
      }

      return clientsWithStats;
    },
  });

  // Fetch client details (pets, appointments, purchases)
  const { data: clientDetails } = useQuery({
    queryKey: ['client-details', selectedClient?.client_id],
    queryFn: async () => {
      if (!selectedClient) return null;

      const [petsRes, appointmentsRes, salesRes] = await Promise.all([
        supabase
          .from('pets')
          .select('*')
          .eq('owner_id', selectedClient.client_id),
        supabase
          .from('appointments')
          .select('*, pets(name)')
          .eq('client_id', selectedClient.client_id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('sales')
          .select('*')
          .eq('customer_id', selectedClient.client_id)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      return {
        pets: petsRes.data || [],
        appointments: appointmentsRes.data || [],
        sales: salesRes.data || [],
      };
    },
    enabled: !!selectedClient,
  });

  const handleViewDetails = (client: ClientStats) => {
    setSelectedClient(client);
    setDetailsOpen(true);
  };

  // Calculate totals
  const totalClients = clients.length;
  const totalPets = clients.reduce((sum, c) => sum + c.pets_count, 0);
  const totalRevenue = clients.reduce((sum, c) => sum + c.total_spent, 0);
  const avgPetsPerClient = totalClients > 0 ? (totalPets / totalClients).toFixed(1) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Gestión de Clientes
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Administra y consulta información de tus clientes
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-medium border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{totalClients}</p>
                  <p className="text-xs text-muted-foreground">Usuarios registrados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-medium border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Mascotas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <PawPrint className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{totalPets}</p>
                  <p className="text-xs text-muted-foreground">{avgPetsPerClient} por cliente</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-medium border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Totales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <p className="text-3xl font-bold">${totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">De todos los clientes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-medium border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Promedio Gasto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold">
                    ${totalClients > 0 ? (totalRevenue / totalClients).toFixed(0) : 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Por cliente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="shadow-medium border-border/50">
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
            <CardDescription>
              Busca y consulta información detallada de cada cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, email o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                <p className="mt-4 text-muted-foreground">Cargando clientes...</p>
              </div>
            ) : clients.length > 0 ? (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead className="text-center">Mascotas</TableHead>
                      <TableHead className="text-center">Citas</TableHead>
                      <TableHead className="text-right">Total Gastado</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.client_id} className="hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <p className="font-medium">{client.full_name}</p>
                            <p className="text-sm text-muted-foreground">{client.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{client.phone}</p>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="gap-1">
                            <PawPrint className="h-3 w-3" />
                            {client.pets_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="gap-1">
                            <Calendar className="h-3 w-3" />
                            {client.appointments_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-primary">
                            ${client.total_spent.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(client.created_at), 'dd MMM yyyy', { locale: es })}
                          </p>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewDetails(client)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? 'No se encontraron clientes con ese criterio' : 'No hay clientes registrados'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                Detalles del Cliente: {selectedClient?.full_name}
              </DialogTitle>
            </DialogHeader>

            {clientDetails && (
              <div className="space-y-6">
                {/* Client Summary */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Mascotas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-primary">{clientDetails.pets.length}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Citas Totales</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-accent">{clientDetails.appointments.length}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Compras</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-secondary">{clientDetails.sales.length}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Pets */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PawPrint className="h-5 w-5" />
                      Mascotas Registradas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {clientDetails.pets.length > 0 ? (
                      <div className="grid md:grid-cols-2 gap-4">
                        {clientDetails.pets.map((pet) => (
                          <div key={pet.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                              {pet.photo_url ? (
                                <img src={pet.photo_url} alt={pet.name} className="h-12 w-12 rounded-full object-cover" />
                              ) : (
                                <PawPrint className="h-6 w-6 text-primary" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{pet.name}</p>
                              <p className="text-sm text-muted-foreground">{pet.species} - {pet.breed || 'Raza no especificada'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">Sin mascotas registradas</p>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Appointments */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Últimas Citas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {clientDetails.appointments.length > 0 ? (
                      <div className="space-y-3">
                        {clientDetails.appointments.map((apt) => {
                          const pet = apt.pets as any;
                          return (
                            <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                              <div>
                                <p className="font-medium">{pet?.name || 'Mascota'}</p>
                                <p className="text-sm text-muted-foreground">
                                  {apt.scheduled_for 
                                    ? format(new Date(apt.scheduled_for), "dd MMM yyyy, HH:mm", { locale: es })
                                    : 'Por agendar'}
                                </p>
                              </div>
                              <Badge variant={apt.status === 'confirmada' ? 'default' : 'outline'}>
                                {apt.status}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">Sin citas registradas</p>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Purchases */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Últimas Compras
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {clientDetails.sales.length > 0 ? (
                      <div className="space-y-3">
                        {clientDetails.sales.map((sale) => (
                          <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div>
                              <p className="font-medium">Compra #{sale.id.slice(0, 8)}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(sale.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                              </p>
                            </div>
                            <p className="font-bold text-secondary">${Number(sale.total).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">Sin compras registradas</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Clientes;
