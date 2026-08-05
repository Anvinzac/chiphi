import { Link } from "react-router-dom";
import { FlaskConical, Sparkles } from "lucide-react";

interface DemoBannerProps {
  variant?: "demo" | "sandbox";
}

export default function DemoBanner({ variant = "demo" }: DemoBannerProps) {
  const sandbox = variant === "sandbox";
  const Icon = sandbox ? FlaskConical : Sparkles;

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
      <Link
        to="/auth"
        className="text-xs font-medium text-primary-foreground bg-primary px-3 py-1 rounded-full whitespace-nowrap hover:opacity-90 transition-opacity"
      >
        {sandbox ? "Đổi tài khoản" : "Đăng ký"}
      </Link>
    </div>
  );
}
