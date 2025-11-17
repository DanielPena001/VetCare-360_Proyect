import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Package, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost: number;
  stock: number;
  reorder_level: number;
  category: string;
};

const Inventario = () => {
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: async () => {
      let query = supabase.from('products').select('*').order('name');
      
      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newProduct: Omit<Product, 'id'>) => {
      const { error } = await supabase.from('products').insert([newProduct]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsCreateOpen(false);
      toast({ title: 'Producto creado exitosamente' });
    },
  });

  const movementMutation = useMutation({
    mutationFn: async (movement: { product_id: string; quantity: number; movement_type: string; reason: string }) => {
      const { error } = await supabase.from('inventory_movements').insert([movement]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsMovementOpen(false);
      setSelectedProduct(null);
      toast({ title: 'Movimiento registrado exitosamente' });
    },
  });

  const handleCreateProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      price: parseFloat(formData.get('price') as string),
      cost: parseFloat(formData.get('cost') as string),
      stock: parseInt(formData.get('stock') as string),
      reorder_level: parseInt(formData.get('reorder_level') as string),
      category: formData.get('category') as string,
    });
  };

  const exportToCSV = () => {
    if (!products) return;
    const headers = ['SKU', 'Nombre', 'Categoría', 'Precio', 'Costo', 'Stock', 'Nivel de Reorden'];
    const rows = products.map(p => [p.sku, p.name, p.category, p.price, p.cost, p.stock, p.reorder_level]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-primary">Inventario</h1>
          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline">Exportar CSV</Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Nuevo Producto</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Crear Producto</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateProduct} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="name">Nombre</Label><Input id="name" name="name" required /></div>
                    <div className="space-y-2"><Label htmlFor="sku">SKU</Label><Input id="sku" name="sku" required /></div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoría</Label>
                    <select id="category" name="category" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="alimentos">Alimentos</option>
                      <option value="medicamentos">Medicamentos</option>
                      <option value="accesorios">Accesorios</option>
                      <option value="higiene">Higiene</option>
                      <option value="juguetes">Juguetes</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="price">Precio</Label><Input id="price" name="price" type="number" step="0.01" required /></div>
                    <div className="space-y-2"><Label htmlFor="cost">Costo</Label><Input id="cost" name="cost" type="number" step="0.01" required /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="stock">Stock Inicial</Label><Input id="stock" name="stock" type="number" defaultValue="0" required /></div>
                    <div className="space-y-2"><Label htmlFor="reorder_level">Nivel de Reorden</Label><Input id="reorder_level" name="reorder_level" type="number" defaultValue="10" required /></div>
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creando...' : 'Crear Producto'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Cargando productos...</p>
            ) : products && products.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono">{product.sku}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="capitalize">{product.category}</TableCell>
                      <TableCell className="text-right">${product.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{product.stock}</TableCell>
                      <TableCell>
                        {product.stock <= product.reorder_level ? (
                          <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Bajo</Badge>
                        ) : (
                          <Badge variant="default">Normal</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => { setSelectedProduct(product); setIsMovementOpen(true); }}>
                          <Package className="mr-2 h-3 w-3" />Movimiento
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">No hay productos en el inventario</p>
            )}
          </CardContent>
        </Card>

        <Dialog open={isMovementOpen} onOpenChange={setIsMovementOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Movimiento de Inventario</DialogTitle></DialogHeader>
            {selectedProduct && (
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                movementMutation.mutate({
                  product_id: selectedProduct.id,
                  quantity: parseInt(formData.get('quantity') as string),
                  movement_type: formData.get('movement_type') as string,
                  reason: formData.get('reason') as string,
                });
              }} className="space-y-4">
                <div className="space-y-2"><Label>Producto</Label><Input value={selectedProduct.name} disabled /></div>
                <div className="space-y-2">
                  <Label htmlFor="movement_type">Tipo de Movimiento</Label>
                  <select id="movement_type" name="movement_type" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="IN">Entrada (IN)</option>
                    <option value="OUT">Salida (OUT)</option>
                    <option value="ADJUST">Ajuste (ADJUST)</option>
                  </select>
                </div>
                <div className="space-y-2"><Label htmlFor="quantity">Cantidad</Label><Input id="quantity" name="quantity" type="number" min="1" required /></div>
                <div className="space-y-2"><Label htmlFor="reason">Razón</Label><Input id="reason" name="reason" placeholder="Motivo del movimiento" /></div>
                <Button type="submit" className="w-full" disabled={movementMutation.isPending}>
                  {movementMutation.isPending ? 'Registrando...' : 'Registrar Movimiento'}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Inventario;
