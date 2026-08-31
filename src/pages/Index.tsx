import { useState } from "react";
import DailyExpenseTable from "@/components/daily/DailyExpenseTable";
import DemoBanner from "@/components/DemoBanner";
import SnapshotBanner from "@/components/SnapshotBanner";
import { useAuth } from "@/hooks/useAuth";
import { isDemoUser } from "@/hooks/useDemoAuth";
import { isSandboxUser } from "@/hooks/useSandboxAuth";
import { Link } from "react-router-dom";
import { Calendar, ClipboardList, LayoutDashboard } from "lucide-react";
import type { MonthMetric } from "@/components/daily/MonthOverviewGrid";

const MONTH_METRICS: { id: MonthMetric; label: string }[] = [
  { id: "revenue", label: "Revenue" },
  { id: "profit", label: "Profit" },
  { id: "percentage", label: "%" },
];

const Index = () => {
  const { signOut, user } = useAuth();
  const isDemo = isDemoUser(user?.email);
  const isSandbox = isSandboxUser(user?.email);
  const [monthOverview, setMonthOverview] = useState(false);
  const [monthMetric, setMonthMetric] = useState<MonthMetric>("revenue");

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      {isDemo && <DemoBanner />}
      {isSandbox && <DemoBanner variant="sandbox" />}
      <SnapshotBanner />
      <DailyExpenseTable
        isDemo={isDemo}
        onSignOut={signOut}
        monthOverview={monthOverview}
        onMonthOverviewChange={setMonthOverview}
        monthMetric={monthMetric}
      />
      <nav className="app-tabbar z-30 grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t border-border bg-card px-3 pt-2">
        <div className="flex items-center gap-1.5">
          <Link
            to="/admin"
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            aria-label="Open Admin"
          >
            <LayoutDashboard className="h-4 w-4" />
            Admin
          </Link>
          <button
            type="button"
            aria-pressed={monthOverview}
            aria-label={monthOverview ? "Đóng xem tháng" : "Xem tháng"}
            onClick={() => setMonthOverview(open => !open)}
            className={[
              "inline-flex items-center justify-center rounded-lg p-2 transition-colors",
              monthOverview
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            ].join(" ")}
          >
            <Calendar className="h-4 w-4" />
          </button>
        </div>
        {monthOverview ? (
          <div
            className="flex min-w-0 justify-center"
            role="tablist"
            aria-label="Month metric"
          >
            <div className="grid w-full max-w-full grid-cols-3 items-stretch rounded-full border border-border/60 bg-muted/35 p-0.5">
              {MONTH_METRICS.map(item => {
                const active = monthMetric === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMonthMetric(item.id)}
                    className={[
                      "rounded-full text-center text-[10px] font-medium tracking-wide transition-colors",
                      "app-month-metric-seg",
                      active
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div />
        )}
        <Link
          to="/orders"
          state={{ fromMain: true }}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          aria-label="Đặt hàng"
        >
          <ClipboardList className="h-4 w-4" />
          Đặt hàng
        </Link>
      </nav>
    </div>
  );
};

export default Index;
