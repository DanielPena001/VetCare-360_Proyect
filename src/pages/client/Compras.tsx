import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ShoppingBag, Download, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';



const Compras = () => {
  const { user } = useAuth();
  const [selectedSale, setSelectedSale] = useState<any>(null);

  // Fetch user's purchases
  const { data: purchases = [] } = useQuery({
    queryKey: ['my-purchases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*, products(name, sku))')
        .eq('customer_id', user?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { variant: 'outline' as const, label: 'Pendiente' },
      paid: { variant: 'default' as const, label: 'Pagado' },
      cancelled: { variant: 'destructive' as const, label: 'Cancelado' },
    };
    const cfg = config[status as keyof typeof config] || config.pending;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const downloadInvoice = (sale: any) => {
  if (!sale) {
    toast.error('No se encontró la venta');
    return;
  }

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  const createdAt = sale.created_at ? new Date(sale.created_at) : new Date();
  const customer = (sale.profiles || {}) as any; // si en el select traes profiles
  const customerName = customer.full_name || 'Cliente';
  const customerPhone = customer.phone || '';

  // ===== CABECERA =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CLÍNICA VETERINARIA EL MUNDO DE HACHI', pageWidth / 2, 15, {
    align: 'center',
  });

  doc.setFontSize(12);
  doc.text('FACTURA DE VENTA', pageWidth / 2, 23, { align: 'center' });

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

    // posición después de la tabla
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
    'Gracias por su compra. Ante cualquier duda, comuníquese con la clínica.',
    pageWidth / 2,
    y,
    { align: 'center' }
  );

  doc.save(
    `factura_${sale.id.slice(0, 8)}_${format(
      createdAt,
      'yyyy-MM-dd'
    )}.pdf`
  );

  toast.success('Factura PDF descargada');
};


  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Mis Compras</h1>
          <p className="text-muted-foreground mt-2">Historial de pedidos y compras realizadas</p>
        </div>

        {purchases.length === 0 ? (
          <Card className="p-12 text-center">
            <ShoppingBag className="h-24 w-24 text-muted-foreground mx-auto mb-6 opacity-50" />
            <h3 className="text-2xl font-semibold mb-2">No tienes compras registradas</h3>
            <p className="text-muted-foreground mb-6">
              Comienza a comprar en nuestro mercadito
            </p>
            <Button onClick={() => window.location.href = '/client/mercadito'} className="gradient-primary">
              Ir al Mercadito
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {purchases.map((purchase) => {
              const items = Array.isArray(purchase.sale_items) ? purchase.sale_items : [];
              const totalItems = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
              
              return (
                <Card key={purchase.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl">
                          Pedido #{purchase.id.substring(0, 8)}
                        </CardTitle>
                        <CardDescription className="text-base mt-1">
                          {format(new Date(purchase.created_at), "dd 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                        </CardDescription>
                      </div>
                      {getStatusBadge(purchase.payment_status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-xl font-bold text-primary">${purchase.total.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Productos</p>
                        <p className="text-lg font-semibold">{items.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Unidades</p>
                        <p className="text-lg font-semibold">{totalItems}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Estado</p>
                        <p className="text-lg font-semibold">
                          {purchase.payment_status === 'paid' ? 'Completado' : 'En Proceso'}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setSelectedSale(purchase)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ver Detalle
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => downloadInvoice(purchase.id)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Factura PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Sale Details Dialog */}
        <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                Detalle del Pedido #{selectedSale?.id.substring(0, 8)}
              </DialogTitle>
            </DialogHeader>

            {selectedSale && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha</p>
                    <p className="font-medium">
                      {format(new Date(selectedSale.created_at), "dd 'de' MMMM, yyyy", { locale: es })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Estado</p>
                    {getStatusBadge(selectedSale.payment_status)}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3">Productos</h3>
                  <div className="space-y-3">
                    {(selectedSale.sale_items || []).map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{item.products?.name}</p>
                          <p className="text-sm text-muted-foreground">SKU: {item.products?.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{item.quantity} x ${item.unit_price.toFixed(2)}</p>
                          <p className="text-sm text-primary font-bold">${item.subtotal.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-semibold">Total:</span>
                    <span className="text-3xl font-bold text-primary">
                      ${selectedSale.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => downloadInvoice(selectedSale.id)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Factura PDF
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Compras;
