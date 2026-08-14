import { Link } from "react-router-dom";
import { ArrowLeft, Store } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import VendorsManager from "@/components/vendors/VendorsManager";

export default function Vendors() {
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
              <Store className="h-4 w-4 text-primary shrink-0" />
              <h1 className="font-display text-xl text-foreground">Nhà cung cấp</h1>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Quản lý vendor mặc định và thường dùng khi thêm chi tiêu
            </p>
          </div>
          <Link
            to="/admin"
            className="text-[11px] text-muted-foreground hover:text-foreground shrink-0"
          >
            Admin
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6">
        {user ? (
          <VendorsManager userId={user.id} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">
            Đăng nhập để quản lý nhà cung cấp
          </p>
        )}
      </div>
    </div>
  );
}
