import { Link } from "react-router-dom";
import { ArrowLeft, Palette, FormInput } from "lucide-react";

export default function Settings() {
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
          <div>
            <h1 className="font-display text-xl text-foreground">Cài đặt</h1>
            <p className="text-[11px] text-muted-foreground">Tùy chỉnh giao diện và trường dữ liệu</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <section className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-foreground">
            <Palette className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Giao diện</h2>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Sắp có: chủ đề màu, cỡ chữ, và bố cục danh sách chi tiêu.
          </p>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-foreground">
            <FormInput className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Trường dữ liệu</h2>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Sắp có: bật/tắt ghi chú, đơn vị mặc định, và các trường tùy chỉnh khi thêm chi tiêu.
          </p>
        </section>
      </div>
    </div>
  );
}
