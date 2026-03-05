import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

export default function DemoBanner() {
  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs text-primary truncate">Bạn đang dùng thử</span>
      </div>
      <Link
        to="/auth"
        className="text-xs font-medium text-primary-foreground bg-primary px-3 py-1 rounded-full whitespace-nowrap hover:opacity-90 transition-opacity"
      >
        Đăng ký
      </Link>
    </div>
  );
}
