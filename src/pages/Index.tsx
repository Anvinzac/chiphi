import DailyExpenseTable from "@/components/daily/DailyExpenseTable";
import DemoBanner from "@/components/DemoBanner";
import { useAuth } from "@/hooks/useAuth";
import { isDemoUser } from "@/hooks/useDemoAuth";
import { Link } from "react-router-dom";
import { LayoutDashboard, LogOut } from "lucide-react";

const Index = () => {
  const { signOut, user } = useAuth();
  const isDemo = isDemoUser(user?.email);

  return (
    <div className="min-h-screen flex flex-col">
      {isDemo && <DemoBanner />}
      <DailyExpenseTable />
      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card px-4 py-2 flex items-center justify-between safe-area-bottom">
        <Link to="/admin" className="flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-2 rounded-lg hover:bg-muted">
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
        {!isDemo ? (
          <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-2 rounded-lg hover:bg-muted">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        ) : (
          <Link to="/auth" className="flex items-center gap-1.5 text-xs text-primary font-medium px-3 py-2 rounded-lg hover:bg-muted">
            Đăng nhập
          </Link>
        )}
      </div>
    </div>
  );
};

export default Index;
