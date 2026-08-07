import DailyExpenseTable from "@/components/daily/DailyExpenseTable";
import DemoBanner from "@/components/DemoBanner";
import { useAuth } from "@/hooks/useAuth";
import { isDemoUser } from "@/hooks/useDemoAuth";
import { isSandboxUser } from "@/hooks/useSandboxAuth";
import { Link } from "react-router-dom";
import { ClipboardList, LayoutDashboard } from "lucide-react";

const Index = () => {
  const { signOut, user } = useAuth();
  const isDemo = isDemoUser(user?.email);
  const isSandbox = isSandboxUser(user?.email);

  return (
    <div className="min-h-screen flex flex-col">
      {isDemo && <DemoBanner />}
      {isSandbox && <DemoBanner variant="sandbox" />}
      <DailyExpenseTable isDemo={isDemo} onSignOut={signOut} />
      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card px-4 py-2 flex items-center justify-between safe-area-bottom z-30">
        <Link
          to="/admin"
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          aria-label="Open Admin"
        >
          <LayoutDashboard className="h-4 w-4" />
          Admin
        </Link>
        <Link
          to="/orders"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          aria-label="Đặt hàng"
        >
          <ClipboardList className="h-4 w-4" />
          Đặt hàng
        </Link>
      </div>
    </div>
  );
};

export default Index;
