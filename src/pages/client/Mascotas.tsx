import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { PawPrint, Plus, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
const Mascotas = () => {
  const {
    user
  } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [petForm, setPetForm] = useState({
    name: '',
    species: 'perro',
    breed: '',
    sex: 'macho',
    birth_date: '',
    color: ''
  });
  const queryClient = useQueryClient();

  // Fetch user's pets
  const {
    data: pets = []
  } = useQuery({
    queryKey: ['my-pets'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('pets').select('*, appointments(count), clinical_records(id)').eq('owner_id', user?.id).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Create pet mutation
  const createPetMutation = useMutation({
    mutationFn: async (formData: typeof petForm) => {
      const {
        error
      } = await supabase.from('pets').insert({
        owner_id: user?.id,
        name: formData.name,
        species: formData.species,
        breed: formData.breed || null,
        sex: formData.sex || null,
        birth_date: formData.birth_date || null,
        color: formData.color || null
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Mascota registrada exitosamente');
      setPetForm({
        name: '',
        species: 'perro',
        breed: '',
        sex: 'macho',
        birth_date: '',
        color: ''
      });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({
        queryKey: ['my-pets']
      });
    },
    onError: (error: any) => {
      toast.error('Error al registrar mascota: ' + error.message);
    }
  });
  const getAge = (birthDate: string) => {
    if (!birthDate) return 'N/A';
    const years = Math.floor((new Date().getTime() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365));
    return years === 0 ? 'Menos de 1 año' : `${years} año${years > 1 ? 's' : ''}`;
  };
  return <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">Mis Mascotas</h1>
            <p className="text-muted-foreground mt-2">Gestiona la información de tus compañeros peludos</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary">
                <Plus className="mr-2 h-4 w-4" />
                Agregar Mascota
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar Nueva Mascota</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre *</Label>
                  <Input id="name" placeholder="Ej: Max, Luna, Firulais" value={petForm.name} onChange={e => setPetForm({
                  ...petForm,
                  name: e.target.value
                })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="species">Especie *</Label>
                    <Select value={petForm.species} onValueChange={value => setPetForm({
                    ...petForm,
                    species: value
                  })}>
                      <SelectTrigger id="species">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="perro">Perro</SelectItem>
                        <SelectItem value="gato">Gato</SelectItem>
                        <SelectItem value="ave">Ave</SelectItem>
                        <SelectItem value="roedor">Roedor</SelectItem>
                        <SelectItem value="reptil">Reptil</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sex">Sexo</Label>
                    <Select value={petForm.sex} onValueChange={value => setPetForm({
                    ...petForm,
                    sex: value
                  })}>
                      <SelectTrigger id="sex">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="macho">Macho</SelectItem>
                        <SelectItem value="hembra">Hembra</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="breed">Raza</Label>
                  <Input id="breed" placeholder="Ej: Labrador, Siamés, etc." value={petForm.breed} onChange={e => setPetForm({
                  ...petForm,
                  breed: e.target.value
                })} />
                </div>
                <div>
                  <Label htmlFor="color">Color</Label>
                  <Input id="color" placeholder="Ej: Negro, Blanco, Marrón" value={petForm.color} onChange={e => setPetForm({
                  ...petForm,
                  color: e.target.value
                })} />
                </div>
                <div>
                  <Label htmlFor="birth_date">Fecha de Nacimiento</Label>
                  <Input id="birth_date" type="date" value={petForm.birth_date} onChange={e => setPetForm({
                  ...petForm,
                  birth_date: e.target.value
                })} />
                </div>
                <Button className="w-full gradient-primary" onClick={() => createPetMutation.mutate(petForm)} disabled={createPetMutation.isPending || !petForm.name}>
                  Registrar Mascota
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {pets.length === 0 ? <Card className="p-12 text-center">
            <PawPrint className="h-24 w-24 text-muted-foreground mx-auto mb-6 opacity-50" />
            <h3 className="text-2xl font-semibold mb-2">No tienes mascotas registradas</h3>
            <p className="text-muted-foreground mb-6">
              Comienza registrando a tu primera mascota para acceder a todos nuestros servicios
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="gradient-primary">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Mi Primera Mascota
            </Button>
          </Card> : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pets.map(pet => <Card key={pet.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                <div className="h-32 gradient-primary flex items-center justify-center">
                  <PawPrint className="h-16 w-16 text-white" />
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl">{pet.name}</CardTitle>
                  <CardDescription className="text-base">
                    {pet.species.charAt(0).toUpperCase() + pet.species.slice(1)}
                    {pet.breed && ` • ${pet.breed}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Edad</p>
                      <p className="font-medium">{getAge(pet.birth_date)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sexo</p>
                      <p className="font-medium">
                        {pet.sex?.charAt(0).toUpperCase() + pet.sex?.slice(1) || 'N/A'}
                      </p>
                    </div>
                    {pet.color && <div>
                        <p className="text-muted-foreground">Color</p>
                        <p className="font-medium">{pet.color}</p>
                      </div>}
                  </div>

                  <div className="pt-4 border-t space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Citas</span>
                      </div>
                      <span className="font-medium">
                        {Array.isArray(pet.appointments) ? pet.appointments.length : 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>Historia Clínica</span>
                      </div>
                      <span className="font-medium">
                        {Array.isArray(pet.clinical_records) && pet.clinical_records.length > 0 ? 'Sí' : 'No'}
                      </span>
                    </div>
                  </div>

                  
                </CardContent>
              </Card>)}
          </div>}
      </div>
    </DashboardLayout>;
};
export default Mascotas;