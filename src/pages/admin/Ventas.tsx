import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Search, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText } from 'lucide-react'; 


interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

const Ventas = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('none');
  const [productSearch, setProductSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const queryClient = useQueryClient();

  
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-sale', productSearch],
    queryFn: async () => {
      let query = supabase.from('products').select('*');
      if (productSearch) {
        query = query.or(`name.ilike.%${productSearch}%,sku.ilike.%${productSearch}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      
      const { data: clientRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'client');
      
      if (rolesError) throw rolesError;
      if (!clientRoles || clientRoles.length === 0) return [];

      const clientIds = clientRoles.map(r => r.user_id);

      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', clientIds);
      
      if (error) throw error;
      return data || [];
    },
  });

  
  const { data: sales = [] } = useQuery({
    queryKey: ['sales', dateFilter],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select('*, profiles!sales_customer_id_fkey(full_name), sale_items(*, products(name))')
        .order('created_at', { ascending: false });
      
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const downloadInvoice = (sale: any) => {
  if (!sale) {
    toast.error('No se encontró la venta');
    return;
  }

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  const createdAt = sale.created_at ? new Date(sale.created_at) : new Date();
  const customer = (sale.profiles || {}) as any;
  const customerName = customer.full_name || 'Cliente';
  const customerPhone = customer.phone || '';

  // ===== CABECERA =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CLÍNICA VETERINARIA EL MUNDO DE HACHI', pageWidth / 2, 15, {
    align: 'center',
  });

  doc.setFontSize(12);
  doc.text('FACTURA DE VENTA - COPIA ADMIN', pageWidth / 2, 23, {
    align: 'center',
  });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Factura N°: ${sale.id.slice(0, 8)}`, 14, 32);
  doc.text(
    `Fecha: ${format(createdAt, 'dd/MM/yyyy HH:mm')}`,
    pageWidth - 70,
    32
  );

  doc.text(
    `Estado: ${
      sale.payment_status === 'paid' ? 'PAGADO' : 'PENDIENTE'
    }`,
    14,
    38
  );

  let y = 46;

  // ===== DATOS DEL CLIENTE =====
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL CLIENTE', 14, y);
  doc.line(14, y + 1, pageWidth - 14, y + 1);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre: ${customerName}`, 14, y);
  y += 5;
  doc.text(`Teléfono: ${customerPhone}`, 14, y);
  y += 8;

  // ===== DETALLE DE LA VENTA =====
  doc.setFont('helvetica', 'bold');
  doc.text('DETALLE DE LA VENTA', 14, y);
  doc.line(14, y + 1, pageWidth - 14, y + 1);
  y += 6;

  const items = (sale.sale_items || []) as any[];

  if (!items.length) {
    doc.setFont('helvetica', 'normal');
    doc.text('No hay ítems en esta venta.', 14, y);
  } else {
    const body = items.map((item) => {
      const product = (item.products || {}) as any;
      const name = product.name || 'Producto';
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(
        item.unit_price ?? item.price ?? 0
      );
      const subtotal =
        Number(item.subtotal ?? unitPrice * quantity);

      return [
        name,
        quantity.toString(),
        `$${unitPrice.toFixed(2)}`,
        `$${subtotal.toFixed(2)}`,
      ];
    });

    (autoTable as any)(doc, {
      head: [['Producto', 'Cant.', 'Precio', 'Subtotal']],
      body,
      startY: y,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: {
        fillColor: [230, 230, 230],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 20, halign: 'right' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
      },
    });

    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ===== TOTALES =====
  const total = Number(sale.total || 0);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `TOTAL: $${total.toFixed(2)}`,
    pageWidth - 14,
    y,
    { align: 'right' }
  );
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Copia para administración. Conserve este documento para control contable.',
    pageWidth / 2,
    y,
    { align: 'center' }
  );

  doc.save(
    `factura_admin_${sale.id.slice(0, 8)}_${format(
      createdAt,
      'yyyy-MM-dd'
    )}.pdf`
  );

  toast.success('Factura PDF (admin) descargada');
};


  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('No autenticado');

      const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          customer_id: selectedClient === 'none' ? null : selectedClient,
          total,
          payment_status: 'paid',
          created_by: user.data.user.id,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      return sale;
    },
    onSuccess: () => {
      toast.success('Venta registrada exitosamente');
      setCart([]);
      setSelectedClient('none');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      toast.error('Error al registrar venta: ' + error.message);
    },
  });

  
  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ saleId, status }: { saleId: string; status: string }) => {
      const { error } = await supabase
        .from('sales')
        .update({ payment_status: status })
        .eq('id', saleId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Estado de pago actualizado');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (error) => {
      toast.error('Error al actualizar estado: ' + error.message);
    },
  });

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.product_id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.price,
        subtotal: product.price,
      }]);
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.product_id !== productId));
    } else {
      setCart(cart.map(item =>
        item.product_id === productId
          ? { ...item, quantity, subtotal: quantity * item.unit_price }
          : item
      ));
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const exportToCSV = () => {
    const headers = ['Fecha', 'Cliente', 'Total', 'Estado'];
    const rows = sales.map(sale => [
      format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm', { locale: es }),
      sale.profiles?.full_name || 'Sin cliente',
      sale.total.toFixed(2),
      sale.payment_status,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    toast.success('Ventas exportadas a CSV');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-primary">Punto de Venta</h1>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* POS Section */}
          <Card>
            <CardHeader>
              <CardTitle>Nueva Venta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Cliente</label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Venta sin cliente asignado</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.full_name} {client.phone ? `- ${client.phone}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedClient === 'none' 
                    ? 'Esta venta no estará asociada a ningún cliente' 
                    : 'La venta se registrará para el cliente seleccionado'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Buscar Producto</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre o SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  <Button variant="outline" size="icon">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {products.map((product) => (
                  <div key={product.id} className="flex justify-between items-center p-2 border rounded">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ${product.price} | Stock: {product.stock}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => addToCart(product)}
                      disabled={product.stock <= 0}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Carrito</h3>
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay productos en el carrito</p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.product_id} className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.product_name}</p>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value))}
                              className="w-20"
                            />
                            <span className="text-sm">x ${item.unit_price}</span>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <span className="font-medium">${item.subtotal.toFixed(2)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromCart(item.product_id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-2xl font-bold">${total.toFixed(2)}</span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createSaleMutation.mutate()}
                  disabled={cart.length === 0 || createSaleMutation.isPending}
                >
                  Registrar Venta
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sales History */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Historial de Ventas</CardTitle>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-auto"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow key={sale.id}>
                        
                        <TableCell className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadInvoice(sale)}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Factura PDF
                          </Button>
                        </TableCell>


                        <TableCell>
                          {format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell>{(sale.profiles as any)?.full_name || 'Sin cliente'}</TableCell>
                        <TableCell>${sale.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Select
                            value={sale.payment_status}
                            onValueChange={(value) => 
                              updatePaymentStatusMutation.mutate({ 
                                saleId: sale.id, 
                                status: value 
                              })
                            }
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="paid">Pagado</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Ventas;
