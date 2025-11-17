import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, ShoppingCart, Package, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type DateRange = 'today' | '7days' | '30days' | '12months';

const AdminDashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange>('30days');

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case '7days':
        return { start: subDays(now, 7), end: now };
      case '30days':
        return { start: subDays(now, 30), end: now };
      case '12months':
        return { start: subMonths(now, 12), end: now };
    }
  };

  // Métricas principales
  const { data: metrics } = useQuery({
    queryKey: ['admin-metrics', dateRange],
    queryFn: async () => {
      const { start, end } = getDateRange();

      // Ventas totales y número de ventas
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('id, total, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (salesError) throw salesError;

      // Items vendidos con detalles de productos
      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select(`
          quantity,
          unit_price,
          sale_id,
          product_id,
          products (cost)
        `)
        .in('sale_id', sales?.map(s => s.id) || []);

      if (itemsError) throw itemsError;

      const totalRevenue = sales?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0;
      const totalSales = sales?.length || 0;
      const totalProducts = items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const totalProfit = items?.reduce((sum, item) => {
        const cost = (item.products as any)?.cost || 0;
        return sum + (item.quantity * (item.unit_price - cost));
      }, 0) || 0;

      return {
        totalRevenue,
        totalSales,
        totalProducts,
        totalProfit
      };
    }
  });

  // Ventas por día/mes para gráfico
  const { data: salesChart } = useQuery({
    queryKey: ['sales-chart', dateRange],
    queryFn: async () => {
      const { start, end } = getDateRange();

      const { data, error } = await supabase
        .from('sales')
        .select('total, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at');

      if (error) throw error;

      // Agrupar por fecha
      const grouped = data?.reduce((acc: any, sale) => {
        const date = format(new Date(sale.created_at), dateRange === '12months' ? 'MMM yyyy' : 'dd/MM', { locale: es });
        if (!acc[date]) {
          acc[date] = { date, total: 0, count: 0 };
        }
        acc[date].total += Number(sale.total);
        acc[date].count += 1;
        return acc;
      }, {});

      return Object.values(grouped || {});
    }
  });

  // Top 5 productos
  const { data: topProducts } = useQuery({
    queryKey: ['top-products', dateRange],
    queryFn: async () => {
      const { start, end } = getDateRange();

      const { data: salesInRange } = await supabase
        .from('sales')
        .select('id')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const saleIds = salesInRange?.map(s => s.id) || [];

      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          quantity,
          product_id,
          products (name, category)
        `)
        .in('sale_id', saleIds);

      if (error) throw error;

      const grouped = data?.reduce((acc: any, item) => {
        const productId = item.product_id;
        if (!acc[productId]) {
          acc[productId] = {
            name: (item.products as any)?.name,
            category: (item.products as any)?.category,
            quantity: 0
          };
        }
        acc[productId].quantity += item.quantity;
        return acc;
      }, {});

      return Object.values(grouped || {})
        .sort((a: any, b: any) => b.quantity - a.quantity)
        .slice(0, 5);
    }
  });

  // Últimas ventas
  const { data: recentSales } = useQuery({
    queryKey: ['recent-sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          total,
          created_at,
          payment_status,
          customer_id,
          profiles (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    }
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Panel de Administrador</h1>
            <p className="text-muted-foreground mt-2">
              Gestiona el sistema completo de VetCare 360
            </p>
          </div>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="7days">Últimos 7 días</SelectItem>
              <SelectItem value="30days">Últimos 30 días</SelectItem>
              <SelectItem value="12months">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ventas Totales"
            value={`$${metrics?.totalRevenue.toLocaleString('es-CO') || 0}`}
            icon={DollarSign}
            description="Ingresos totales"
          />
          <StatCard
            title="Número de Ventas"
            value={metrics?.totalSales || 0}
            icon={ShoppingCart}
            description="Transacciones realizadas"
          />
          <StatCard
            title="Productos Vendidos"
            value={metrics?.totalProducts || 0}
            icon={Package}
            description="Unidades totales"
          />
          <StatCard
            title="Ganancia Estimada"
            value={`$${metrics?.totalProfit.toLocaleString('es-CO') || 0}`}
            icon={TrendingUp}
            description="Beneficio neto"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tendencia de Ventas</CardTitle>
              <CardDescription>Ventas por {dateRange === '12months' ? 'mes' : 'día'}</CardDescription>
            </CardHeader>
            <CardContent>
              {salesChart && salesChart.length > 0 ? (
                <ChartContainer
                  config={{
                    total: {
                      label: "Ventas",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No hay datos disponibles</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 5 Productos</CardTitle>
              <CardDescription>Más vendidos en el período</CardDescription>
            </CardHeader>
            <CardContent>
              {topProducts && topProducts.length > 0 ? (
                <ChartContainer
                  config={{
                    quantity: {
                      label: "Cantidad",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="quantity" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No hay datos disponibles</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Últimas Ventas</CardTitle>
            <CardDescription>Actividad reciente de ventas</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSales && recentSales.length > 0 ? (
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
                  {recentSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>
                        {(sale.profiles as any)?.full_name || 'Cliente sin registro'}
                      </TableCell>
                      <TableCell className="font-medium">
                        ${Number(sale.total).toLocaleString('es-CO')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sale.payment_status === 'paid' ? 'default' : 'secondary'}>
                          {sale.payment_status === 'paid' ? 'Pagado' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">No hay ventas registradas</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
