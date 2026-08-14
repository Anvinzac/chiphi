import { Link } from "react-router-dom";
import { ArrowLeft, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SchedulesManager from "@/components/schedules/SchedulesManager";

export default function Reminders() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            to="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Quay lại"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary shrink-0" />
              <h1 className="font-display text-xl text-foreground">Lịch nhắc</h1>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tạo và quản lý chi tiêu định kỳ, xem ngày nhắc tiếp theo
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6">
        {user ? (
          <SchedulesManager userId={user.id} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">
            Đăng nhập để quản lý lịch nhắc
          </p>
        )}
      </div>
    </div>
  );
}
