import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const HistoriasClinicas = () => {
  const location = useLocation();
  const targetPetId = location.state?.petId;
  const targetPetName = location.state?.petName;
  const cardRef = useRef<HTMLDivElement>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState({
    record_id: '',
    reason: '',
    diagnosis: '',
    treatment: '',
    prescriptions: '',
    weight: '',
    temperature: '',
    next_appointment: '',
  });
  const queryClient = useQueryClient();

  // Fetch clinical records with entries
  const { data: records = [] } = useQuery({
    queryKey: ['clinical-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinical_records')
        .select('*, pets(id, name, species, profiles(full_name)), clinical_entries(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Scroll to target pet card when data loads
  useEffect(() => {
    if (targetPetId && records.length > 0 && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [targetPetId, records]);

  // Create clinical entry
  const createEntryMutation = useMutation({
    mutationFn: async (formData: typeof entryForm) => {
      const user = await supabase.auth.getUser();
      const { error } = await supabase.from('clinical_entries').insert({
        record_id: formData.record_id,
        vet_id: user.data.user?.id,
        reason: formData.reason,
        diagnosis: formData.diagnosis || null,
        treatment: formData.treatment || null,
        prescriptions: formData.prescriptions || null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        temperature: formData.temperature ? parseFloat(formData.temperature) : null,
        next_appointment: formData.next_appointment || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Entrada clínica creada');
      setEntryForm({
        record_id: '',
        reason: '',
        diagnosis: '',
        treatment: '',
        prescriptions: '',
        weight: '',
        temperature: '',
        next_appointment: '',
      });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['clinical-records'] });
    },
    onError: (error) => {
      toast.error('Error al crear entrada: ' + error.message);
    },
  });

  const downloadPDF = (recordId: string) => {
    // Placeholder for PDF generation
    toast.info('Función de descarga PDF en desarrollo');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-primary">Historias Clínicas</h1>
          {targetPetName && (
            <div className="text-sm text-muted-foreground">
              Mostrando historial de: <span className="font-semibold text-foreground">{targetPetName}</span>
            </div>
          )}
        </div>

        <div className="grid gap-6">
          {records.map((record) => {
            const pet = record.pets as any;
            const entries = Array.isArray(record.clinical_entries) ? record.clinical_entries : [];
            const isTargetPet = targetPetId && pet?.id === targetPetId;
            
            return (
              <Card 
                key={record.id}
                ref={isTargetPet ? cardRef : null}
                className={isTargetPet ? 'ring-2 ring-primary' : ''}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{pet?.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {pet?.species} - Dueño: {pet?.profiles?.full_name}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Dialog open={isDialogOpen && selectedRecord === record.id} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (open) {
                          setSelectedRecord(record.id);
                          setEntryForm({ ...entryForm, record_id: record.id });
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Agregar Entrada
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Nueva Entrada Clínica</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 max-h-[600px] overflow-y-auto">
                            <div>
                              <Label htmlFor="reason">Motivo de Consulta *</Label>
                              <Textarea
                                id="reason"
                                value={entryForm.reason}
                                onChange={(e) => setEntryForm({ ...entryForm, reason: e.target.value })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="weight">Peso (kg)</Label>
                                <Input
                                  id="weight"
                                  type="number"
                                  step="0.1"
                                  value={entryForm.weight}
                                  onChange={(e) => setEntryForm({ ...entryForm, weight: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="temperature">Temperatura (°C)</Label>
                                <Input
                                  id="temperature"
                                  type="number"
                                  step="0.1"
                                  value={entryForm.temperature}
                                  onChange={(e) => setEntryForm({ ...entryForm, temperature: e.target.value })}
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="diagnosis">Diagnóstico</Label>
                              <Textarea
                                id="diagnosis"
                                value={entryForm.diagnosis}
                                onChange={(e) => setEntryForm({ ...entryForm, diagnosis: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="treatment">Tratamiento</Label>
                              <Textarea
                                id="treatment"
                                value={entryForm.treatment}
                                onChange={(e) => setEntryForm({ ...entryForm, treatment: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="prescriptions">Recetas/Medicamentos</Label>
                              <Textarea
                                id="prescriptions"
                                value={entryForm.prescriptions}
                                onChange={(e) => setEntryForm({ ...entryForm, prescriptions: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="next-appointment">Próxima Cita</Label>
                              <Input
                                id="next-appointment"
                                type="date"
                                value={entryForm.next_appointment}
                                onChange={(e) => setEntryForm({ ...entryForm, next_appointment: e.target.value })}
                              />
                            </div>
                            <Button
                              className="w-full"
                              onClick={() => createEntryMutation.mutate(entryForm)}
                              disabled={createEntryMutation.isPending || !entryForm.reason}
                            >
                              Guardar Entrada
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button size="sm" variant="outline" onClick={() => downloadPDF(record.id)}>
                        <Download className="mr-2 h-4 w-4" />
                        Descargar PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay entradas clínicas registradas
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {entries.map((entry: any) => (
                        <div key={entry.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {format(new Date(entry.visit_date), "dd 'de' MMMM, yyyy", { locale: es })}
                              </span>
                            </div>
                            {entry.weight && (
                              <span className="text-sm text-muted-foreground">
                                Peso: {entry.weight} kg
                              </span>
                            )}
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Motivo:</span> {entry.reason}
                            </div>
                            {entry.diagnosis && (
                              <div>
                                <span className="font-medium">Diagnóstico:</span> {entry.diagnosis}
                              </div>
                            )}
                            {entry.treatment && (
                              <div>
                                <span className="font-medium">Tratamiento:</span> {entry.treatment}
                              </div>
                            )}
                            {entry.prescriptions && (
                              <div>
                                <span className="font-medium">Recetas:</span> {entry.prescriptions}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default HistoriasClinicas;
