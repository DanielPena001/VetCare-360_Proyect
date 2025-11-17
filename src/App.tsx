import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import Inventario from "./pages/admin/Inventario";
import Ventas from "./pages/admin/Ventas";
import Clientes from "./pages/admin/Clientes";
import Usuarios from "./pages/admin/Usuarios";
import Reportes from "./pages/admin/Reportes";

// Vet pages
import VetDashboard from "./pages/vet/VetDashboard";
import Pacientes from "./pages/vet/Pacientes";
import Citas from "./pages/vet/Citas";
import HistoriasClinicas from "./pages/vet/HistoriasClinicas";

// Client pages
import ClientDashboard from "./pages/client/ClientDashboard";
import Mascotas from "./pages/client/Mascotas";
import CitasCliente from "./pages/client/CitasCliente";
import Mercadito from "./pages/client/Mercadito";
import Compras from "./pages/client/Compras";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          
          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/inventario" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Inventario />
            </ProtectedRoute>
          } />
          <Route path="/admin/ventas" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Ventas />
            </ProtectedRoute>
          } />
          <Route path="/admin/clientes" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Clientes />
            </ProtectedRoute>
          } />
          <Route path="/admin/usuarios" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Usuarios />
            </ProtectedRoute>
          } />
          <Route path="/admin/reportes" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Reportes />
            </ProtectedRoute>
          } />

          {/* Vet Routes */}
          <Route path="/vet/dashboard" element={
            <ProtectedRoute allowedRoles={['vet']}>
              <VetDashboard />
            </ProtectedRoute>
          } />
          <Route path="/vet/pacientes" element={
            <ProtectedRoute allowedRoles={['vet']}>
              <Pacientes />
            </ProtectedRoute>
          } />
          <Route path="/vet/citas" element={
            <ProtectedRoute allowedRoles={['vet']}>
              <Citas />
            </ProtectedRoute>
          } />
          <Route path="/vet/historias-clinicas" element={
            <ProtectedRoute allowedRoles={['vet']}>
              <HistoriasClinicas />
            </ProtectedRoute>
          } />

          {/* Client Routes */}
          <Route path="/client/dashboard" element={
            <ProtectedRoute allowedRoles={['client']}>
              <ClientDashboard />
            </ProtectedRoute>
          } />
          <Route path="/client/mascotas" element={
            <ProtectedRoute allowedRoles={['client']}>
              <Mascotas />
            </ProtectedRoute>
          } />
          <Route path="/client/citas" element={
            <ProtectedRoute allowedRoles={['client']}>
              <CitasCliente />
            </ProtectedRoute>
          } />
          <Route path="/client/mercadito" element={
            <ProtectedRoute allowedRoles={['client']}>
              <Mercadito />
            </ProtectedRoute>
          } />
          <Route path="/client/compras" element={
            <ProtectedRoute allowedRoles={['client']}>
              <Compras />
            </ProtectedRoute>
          } />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
