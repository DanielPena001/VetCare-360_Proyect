import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { 
  FileText, 
  Download, 
  TrendingUp, 
  Calendar, 
  Package, 
  DollarSign,
  ShoppingCart,
  Users,
  PawPrint,
  BarChart3
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Reportes = () => {
  const [reportType, setReportType] = useState<'ventas' | 'inventario' | 'citas'>('ventas');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // Fetch sales report
  const { data: salesReport, isLoading: salesLoading } = useQuery({
    queryKey: ['sales-report', startDate, endDate],
    queryFn: async () => {
      const { data: sales, error } = await supabase
        .from('sales')
        .select('*, sale_items(*, products(name)), profiles!sales_customer_id_fkey(full_name)')
        .gte('created_at', new Date(startDate).toISOString())
        .lte('created_at', new Date(endDate + 'T23:59:59').toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const totalRevenue = sales?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0;
      const totalSales = sales?.length || 0;
      const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0;

      return {
        sales: sales || [],
        totalRevenue,
        totalSales,
        avgSale,
      };
    },
    enabled: reportType === 'ventas',
  });

  // Fetch inventory report
  const { data: inventoryReport, isLoading: inventoryLoading } = useQuery({
    queryKey: ['inventory-report'],
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;

      const totalProducts = products?.length || 0;
      const totalValue = products?.reduce((sum, p) => sum + (Number(p.price) * p.stock), 0) || 0;
      const lowStock = products?.filter(p => p.stock <= p.reorder_level).length || 0;
      const outOfStock = products?.filter(p => p.stock === 0).length || 0;

      return {
        products: products || [],
        totalProducts,
        totalValue,
        lowStock,
        outOfStock,
      };
    },
    enabled: reportType === 'inventario',
  });

  // Fetch appointments report
  const { data: appointmentsReport, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['appointments-report', startDate, endDate],
    queryFn: async () => {
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*, pets(name, species), profiles!appointments_client_id_fkey(full_name)')
        .gte('created_at', new Date(startDate).toISOString())
        .lte('created_at', new Date(endDate + 'T23:59:59').toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const totalAppointments = appointments?.length || 0;
      const completed = appointments?.filter(a => a.status === 'completada').length || 0;
      const pending = appointments?.filter(a => a.status === 'pendiente').length || 0;
      const cancelled = appointments?.filter(a => a.status === 'cancelada').length || 0;

      return {
        appointments: appointments || [],
        totalAppointments,
        completed,
        pending,
        cancelled,
      };
    },
    enabled: reportType === 'citas',
  });

  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const value = row[h] || '';
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Reporte exportado exitosamente');
  };

  const handleExportSales = () => {
    if (!salesReport?.sales) return;
    
    const data = salesReport.sales.map(sale => {
      const profile = sale.profiles as any;
      return {
        Fecha: format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm'),
        Cliente: profile?.full_name || 'N/A',
        Total: sale.total,
        Estado: sale.payment_status === 'paid' ? 'Pagado' : 'Pendiente',
      };
    });

    exportToCSV(data, 'reporte_ventas', ['Fecha', 'Cliente', 'Total', 'Estado']);
  };

    const handleExportSalesPDF = () => {
    if (!salesReport?.sales || !salesReport.sales.length) {
      toast.error('No hay ventas para exportar en el rango seleccionado');
      return;
    }

    const doc = new jsPDF();

    // Título
    doc.setFontSize(16);
    doc.text('Reporte de Ventas', 14, 20);

    // Info de rango de fechas
    doc.setFontSize(11);
    doc.text(
      `Período: ${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')}`,
      14,
      28
    );
    doc.text(
      `Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
      14,
      34
    );

    // Cuerpo de la tabla
    const body = salesReport.sales.map((sale: any) => {
      const profile = sale.profiles as any;

      const items = (sale.sale_items || [])
        .map((item: any) => {
          const product = item.products as any;
          return `${product?.name || 'Producto'} (${item.quantity})`;
        })
        .join(', ');

      return [
        format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm'),
        profile?.full_name || 'N/A',
        `$${Number(sale.total).toFixed(2)}`,
        sale.payment_status === 'paid' ? 'Pagado' : 'Pendiente',
        items || '—',
      ];
    });

    autoTable(doc, {
      head: [['Fecha', 'Cliente', 'Total', 'Estado', 'Items']],
      body,
      startY: 40,
      styles: { fontSize: 9 },
      headStyles: { fontStyle: 'bold' },
    });

    doc.save(`reporte_ventas_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Reporte PDF de ventas generado');
  };


  const handleExportInventory = () => {
    if (!inventoryReport?.products) return;
    
    const data = inventoryReport.products.map(product => ({
      SKU: product.sku,
      Nombre: product.name,
      Categoría: product.category,
      Stock: product.stock,
      'Stock Mínimo': product.reorder_level,
      Costo: product.cost,
      Precio: product.price,
      'Valor Total': (product.stock * Number(product.price)).toFixed(2),
    }));

    exportToCSV(data, 'reporte_inventario', ['SKU', 'Nombre', 'Categoría', 'Stock', 'Stock Mínimo', 'Costo', 'Precio', 'Valor Total']);
  };

  const handleExportAppointments = () => {
    if (!appointmentsReport?.appointments) return;
    
    const data = appointmentsReport.appointments.map(apt => {
      const pet = apt.pets as any;
      const profile = apt.profiles as any;
      return {
        Fecha: apt.scheduled_for ? format(new Date(apt.scheduled_for), 'dd/MM/yyyy HH:mm') : 'Por agendar',
        Cliente: profile?.full_name || 'N/A',
        Mascota: pet?.name || 'N/A',
        Tipo: apt.type === 'teleconsulta' ? 'Teleconsulta' : 'Presencial',
        Estado: apt.status,
        Motivo: apt.reason,
      };
    });

    exportToCSV(data, 'reporte_citas', ['Fecha', 'Cliente', 'Mascota', 'Tipo', 'Estado', 'Motivo']);
  };

  const isLoading = salesLoading || inventoryLoading || appointmentsLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Reportes y Análisis
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Genera reportes detallados y exporta información del sistema
          </p>
        </div>

        {/* Report Type Selection */}
        <Card className="shadow-medium border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generador de Reportes
            </CardTitle>
            <CardDescription>
              Selecciona el tipo de reporte y el rango de fechas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Tipo de Reporte</Label>
                <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ventas">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        Ventas
                      </div>
                    </SelectItem>
                    <SelectItem value="inventario">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Inventario
                      </div>
                    </SelectItem>
                    <SelectItem value="citas">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Citas
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {reportType !== 'inventario' && (
                <>
                  <div className="space-y-2">
                    <Label>Fecha Inicio</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Fecha Fin</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

                            <div className="flex flex-col sm:flex-row gap-2 items-end">
                <Button 
                  className="w-full sm:w-auto gradient-primary"
                  onClick={() => {
                    if (reportType === 'ventas') handleExportSales();
                    if (reportType === 'inventario') handleExportInventory();
                    if (reportType === 'citas') handleExportAppointments();
                  }}
                  disabled={isLoading}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>

                {reportType === 'ventas' && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={handleExportSalesPDF}
                    disabled={isLoading || !salesReport?.sales?.length}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Exportar PDF (ventas)
                  </Button>
                )}
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Report Content */}
        <Tabs value={reportType} onValueChange={(value: any) => setReportType(value)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ventas">Ventas</TabsTrigger>
            <TabsTrigger value="inventario">Inventario</TabsTrigger>
            <TabsTrigger value="citas">Citas</TabsTrigger>
          </TabsList>

          {/* Sales Report */}
          <TabsContent value="ventas" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-4">
              <Card className="shadow-medium">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Totales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-2xl font-bold">${salesReport?.totalRevenue.toLocaleString() || 0}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Ventas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center">
                      <ShoppingCart className="h-5 w-5 text-secondary" />
                    </div>
                    <p className="text-2xl font-bold">{salesReport?.totalSales || 0}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Venta Promedio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-accent" />
                    </div>
                    <p className="text-2xl font-bold">${salesReport?.avgSale.toFixed(0) || 0}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Período</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">{format(new Date(startDate), 'dd MMM', { locale: es })}</p>
                      <p className="text-muted-foreground">{format(new Date(endDate), 'dd MMM', { locale: es })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Detalle de Ventas</CardTitle>
                <CardDescription>Listado completo de ventas en el período seleccionado</CardDescription>
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                    <p className="mt-4 text-muted-foreground">Generando reporte...</p>
                  </div>
                ) : salesReport?.sales && salesReport.sales.length > 0 ? (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Productos</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesReport.sales.map((sale) => {
                          const profile = sale.profiles as any;
                          const items = sale.sale_items as any[];
                          return (
                            <TableRow key={sale.id}>
                              <TableCell>
                                {format(new Date(sale.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}
                              </TableCell>
                              <TableCell>{profile?.full_name || 'N/A'}</TableCell>
                              <TableCell>
                                {items?.length || 0} producto{items?.length !== 1 ? 's' : ''}
                              </TableCell>
                              <TableCell className="text-right font-bold text-primary">
                                ${Number(sale.total).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  sale.payment_status === 'paid' 
                                    ? 'bg-primary/10 text-primary' 
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  {sale.payment_status === 'paid' ? 'Pagado' : 'Pendiente'}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay ventas en el período seleccionado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Report */}
          <TabsContent value="inventario" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-4">
              <Card className="shadow-medium">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Productos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-2xl font-bold">{inventoryReport?.totalProducts || 0}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-secondary" />
                    </div>
                    <p className="text-2xl font-bold">${inventoryReport?.totalValue.toLocaleString() || 0}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Stock Bajo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-destructive" />
                    </div>
                    <p className="text-2xl font-bold">{inventoryReport?.lowStock || 0}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Sin Stock</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-destructive" />
                    </div>
                    <p className="text-2xl font-bold">{inventoryReport?.outOfStock || 0}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Detalle de Inventario</CardTitle>
                <CardDescription>Estado actual del inventario</CardDescription>
              </CardHeader>
              <CardContent>
                {inventoryLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                    <p className="mt-4 text-muted-foreground">Generando reporte...</p>
                  </div>
                ) : inventoryReport?.products && inventoryReport.products.length > 0 ? (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead className="text-center">Stock</TableHead>
                          <TableHead className="text-center">Mínimo</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventoryReport.products.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-mono">{product.sku}</TableCell>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>{product.category}</TableCell>
                            <TableCell className="text-center">{product.stock}</TableCell>
                            <TableCell className="text-center">{product.reorder_level}</TableCell>
                            <TableCell className="text-right">${Number(product.price).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-bold">
                              ${(product.stock * Number(product.price)).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {product.stock === 0 ? (
                                <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                                  Sin stock
                                </span>
                              ) : product.stock <= product.reorder_level ? (
                                <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                                  Bajo
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                                  OK
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay productos en el inventario</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appointments Report */}
          <TabsContent value="citas" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-4">
              <Card className="shadow-medium">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Citas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-2xl font-bold">{appointmentsReport?.totalAppointments || 0}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Completadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-2xl font-bold">{appointmentsReport?.completed || 0}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-yellow-700" />
                    </div>
                    <p className="text-2xl font-bold">{appointmentsReport?.pending || 0}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Canceladas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-destructive" />
                    </div>
                    <p className="text-2xl font-bold">{appointmentsReport?.cancelled || 0}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Detalle de Citas</CardTitle>
                <CardDescription>Listado completo de citas en el período seleccionado</CardDescription>
              </CardHeader>
              <CardContent>
                {appointmentsLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                    <p className="mt-4 text-muted-foreground">Generando reporte...</p>
                  </div>
                ) : appointmentsReport?.appointments && appointmentsReport.appointments.length > 0 ? (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Mascota</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appointmentsReport.appointments.map((apt) => {
                          const pet = apt.pets as any;
                          const profile = apt.profiles as any;
                          return (
                            <TableRow key={apt.id}>
                              <TableCell>
                                {apt.scheduled_for 
                                  ? format(new Date(apt.scheduled_for), 'dd MMM yyyy, HH:mm', { locale: es })
                                  : 'Por agendar'}
                              </TableCell>
                              <TableCell>{profile?.full_name || 'N/A'}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <PawPrint className="h-4 w-4 text-muted-foreground" />
                                  {pet?.name || 'N/A'}
                                </div>
                              </TableCell>
                              <TableCell>
                                {apt.type === 'teleconsulta' ? 'Teleconsulta' : 'Presencial'}
                              </TableCell>
                              <TableCell className="max-w-xs truncate">{apt.reason}</TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  apt.status === 'completada' ? 'bg-primary/10 text-primary' :
                                  apt.status === 'confirmada' ? 'bg-accent/10 text-accent' :
                                  apt.status === 'cancelada' ? 'bg-destructive/10 text-destructive' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {apt.status}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay citas en el período seleccionado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reportes;
