import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ShoppingBag, Plus, Minus, Trash2, ShoppingCart, Search } from 'lucide-react';

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  stock: number;
}

const Mercadito = () => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products-shop', searchTerm, categoryFilter],
    queryFn: async () => {
      let query = supabase.from('products').select('*').gt('stock', 0);
      
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`);
      }
      
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Get unique categories
  const categories = ['all', ...new Set(products.map(p => p.category))];

  // Create purchase mutation
  const createPurchaseMutation = useMutation({
    mutationFn: async () => {
      const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          customer_id: user?.id,
          total,
          payment_status: 'pending',
          created_by: user?.id,
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

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
      if (itemsError) throw itemsError;

      return sale;
    },
    onSuccess: () => {
      toast.success('¡Pedido realizado! Pronto nos contactaremos contigo para el pago.');
      setCart([]);
      setIsCartOpen(false);
      queryClient.invalidateQueries({ queryKey: ['products-shop'] });
    },
    onError: (error: any) => {
      toast.error('Error al realizar pedido: ' + error.message);
    },
  });

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.product_id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        toast.error('No hay suficiente stock disponible');
        return;
      }
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
        stock: product.stock,
      }]);
    }
    toast.success(`${product.name} agregado al carrito`);
  };

  const updateQuantity = (productId: string, newQuantity: number, maxStock: number) => {
    if (newQuantity <= 0) {
      setCart(cart.filter(item => item.product_id !== productId));
    } else if (newQuantity > maxStock) {
      toast.error('No hay suficiente stock disponible');
    } else {
      setCart(cart.map(item =>
        item.product_id === productId
          ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.unit_price }
          : item
      ));
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">Mercadito</h1>
            <p className="text-muted-foreground mt-2">Productos y accesorios para tu mascota</p>
          </div>
          <Button 
            className="gradient-primary relative"
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Carrito
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-secondary text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                {itemCount}
              </span>
            )}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? 'default' : 'outline'}
                onClick={() => setCategoryFilter(cat)}
                size="sm"
              >
                {cat === 'all' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {products.length === 0 ? (
          <Card className="p-12 text-center">
            <ShoppingBag className="h-24 w-24 text-muted-foreground mx-auto mb-6 opacity-50" />
            <h3 className="text-2xl font-semibold mb-2">No se encontraron productos</h3>
            <p className="text-muted-foreground">Intenta con otros términos de búsqueda</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="hover:shadow-lg transition-shadow flex flex-col">
                <div className="aspect-square bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                  <ShoppingBag className="h-20 w-20 text-primary opacity-50" />
                </div>
                <CardHeader className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline">{product.category}</Badge>
                    {product.stock <= product.reorder_level && (
                      <Badge variant="destructive" className="text-xs">
                        Bajo Stock
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <CardDescription>
                    SKU: {product.sku}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">${product.price.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">Stock: {product.stock}</p>
                    </div>
                  </div>
                  <Button
                    className="w-full gradient-primary"
                    onClick={() => addToCart(product)}
                    disabled={product.stock === 0}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar al Carrito
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Cart Dialog */}
        <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Mi Carrito</DialogTitle>
            </DialogHeader>
            
            {cart.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">Tu carrito está vacío</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.product_id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">${item.unit_price.toFixed(2)} c/u</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1, item.stock)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center font-medium">{item.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1, item.stock)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="text-right min-w-[80px]">
                        <p className="font-bold">${item.subtotal.toFixed(2)}</p>
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeFromCart(item.product_id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xl font-semibold">Total:</span>
                    <span className="text-3xl font-bold text-primary">${total.toFixed(2)}</span>
                  </div>
                  
                  <Button
                    className="w-full gradient-primary text-lg py-6"
                    onClick={() => createPurchaseMutation.mutate()}
                    disabled={createPurchaseMutation.isPending}
                  >
                    Realizar Pedido
                  </Button>
                  
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Nos contactaremos contigo para coordinar el pago y la entrega
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Mercadito;
