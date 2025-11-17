import { LayoutDashboard, Package, ShoppingCart, Users, FileText, Stethoscope, Calendar, ClipboardList, PawPrint, ShoppingBag, LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const adminItems = [
  { title: 'Dashboard', url: '/admin/dashboard', icon: LayoutDashboard },
  { title: 'Inventario', url: '/admin/inventario', icon: Package },
  { title: 'Ventas', url: '/admin/ventas', icon: ShoppingCart },
  { title: 'Clientes', url: '/admin/clientes', icon: Users },
  { title: 'Usuarios', url: '/admin/usuarios', icon: Users },
  { title: 'Reportes', url: '/admin/reportes', icon: FileText },
];

const vetItems = [
  { title: 'Dashboard', url: '/vet/dashboard', icon: LayoutDashboard },
  { title: 'Pacientes', url: '/vet/pacientes', icon: PawPrint },
  { title: 'Citas', url: '/vet/citas', icon: Calendar },
  { title: 'Historias Clínicas', url: '/vet/historias-clinicas', icon: ClipboardList },
];

const clientItems = [
  { title: 'Dashboard', url: '/client/dashboard', icon: LayoutDashboard },
  { title: 'Mis Mascotas', url: '/client/mascotas', icon: PawPrint },
  { title: 'Citas', url: '/client/citas', icon: Calendar },
  { title: 'Mercadito', url: '/client/mercadito', icon: ShoppingBag },
  { title: 'Mis Compras', url: '/client/compras', icon: ShoppingCart },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const { getPrimaryRole } = useUserRole();
  const { signOut } = useAuth();
  const currentPath = location.pathname;

  const primaryRole = getPrimaryRole();
  
  let items = clientItems;
  let roleLabel = 'Cliente';
  
  if (primaryRole === 'admin') {
    items = adminItems;
    roleLabel = 'Administrador';
  } else if (primaryRole === 'vet') {
    items = vetItems;
    roleLabel = 'Veterinario';
  }

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {open ? (
              <div className="flex flex-col">
                <span className="text-lg font-bold text-primary">VetCare 360</span>
                <span className="text-xs text-muted-foreground">{roleLabel}</span>
              </div>
            ) : (
              <Stethoscope className="h-5 w-5 text-primary" />
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-accent"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-4 w-4" />
              {open && <span>Cerrar Sesión</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
