import { Link, useNavigate } from "react-router-dom";
import { FlaskConical, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface DemoBannerProps {
  variant?: "demo" | "sandbox";
}

export default function DemoBanner({ variant = "demo" }: DemoBannerProps) {
  const sandbox = variant === "sandbox";
  const Icon = sandbox ? FlaskConical : Sparkles;
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleExit = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div
      className={`border-b px-4 py-2 flex items-center justify-between gap-3 ${
        sandbox ? "bg-accent/25 border-accent/40" : "bg-primary/10 border-primary/20"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${sandbox ? "text-accent-foreground" : "text-primary"}`} />
        <span className={`text-xs truncate ${sandbox ? "text-accent-foreground" : "text-primary"}`}>
          {sandbox ? "Tài khoản thử — dữ liệu riêng, không ảnh hưởng tài khoản khác" : "Bạn đang dùng thử"}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {sandbox && (
          <button
            type="button"
            onClick={handleExit}
            className="flex items-center gap-1 text-xs font-medium text-accent-foreground border border-accent-foreground/25 bg-background/60 px-3 py-1 rounded-full whitespace-nowrap hover:bg-background transition-colors"
            aria-label="Thoát chế độ thử"
          >
            <LogOut className="h-3 w-3" />
            Thoát
          </button>
        )}
        <Link
          to="/auth"
          className="text-xs font-medium text-primary-foreground bg-primary px-3 py-1 rounded-full whitespace-nowrap hover:opacity-90 transition-opacity"
        >
          {sandbox ? "Đổi tài khoản" : "Đăng ký"}
        </Link>
      </div>
    </div>
  );
}
