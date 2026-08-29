import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LaggedSnapshotProvider } from "@/hooks/useLaggedSnapshot";
import { recordAdminDeviceVisit } from "@/lib/adminDevice";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import Vendors from "./pages/Vendors";
import Reminders from "./pages/Reminders";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import MonthlyOrder from "./pages/MonthlyOrder";
import SalaryStaff from "./pages/SalaryStaff";
import SupplierOrder from "./pages/SupplierOrder";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Drop legacy device auto-login preference if any remains
try {
  localStorage.removeItem("mise.autoLogin");
} catch {
  /* noop */
}

function EnrollAdminDevice() {
  useEffect(() => {
    void recordAdminDeviceVisit();
  }, []);
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-muted-foreground">Loading...</span>
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/o/:token" element={<SupplierOrder />} />
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
    <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
    <Route path="/salary" element={<ProtectedRoute><SalaryStaff /></ProtectedRoute>} />
    <Route path="/orders/monthly" element={<ProtectedRoute><MonthlyOrder /></ProtectedRoute>} />
    <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
    <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <EnrollAdminDevice />
        <LaggedSnapshotProvider>
          <AppRoutes />
        </LaggedSnapshotProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
