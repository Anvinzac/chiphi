import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Palette, FormInput, Store, Bell, HardDrive, Download } from "lucide-react";
import { parseISO } from "date-fns";
import { toast } from "sonner";
import SnapshotBanner from "@/components/SnapshotBanner";
import { useLaggedSnapshot } from "@/hooks/useLaggedSnapshot";
import { formatDayMonth } from "@/lib/formatDateVi";
import { THOUSANDS_SUFFIX_OPTIONS } from "@/lib/thousandsSuffix";
import { useThousandsSuffix } from "@/hooks/useThousandsSuffix";
import type { SnapshotMeta } from "@/lib/laggedSnapshot";

function metaLine(meta: SnapshotMeta | null, empty: string) {
  if (!meta) return empty;
  let when = meta.localDate;
  try {
    when = formatDayMonth(parseISO(meta.localDate));
  } catch {
    /* keep iso */
  }
  return `${when} · ${meta.payments} chi tiêu · ${meta.orders} đơn`;
}

export default function Settings() {
  const { todayMeta, yesterdayMeta, refresh, downloadSlot } = useLaggedSnapshot();
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useThousandsSuffix();

  const backupNow = async () => {
    if (saving) return;
    setSaving(true);
    const ok = await refresh();
    setSaving(false);
    if (ok) toast.success("Đã cập nhật bản sao trên máy");
    else toast.error("Không sao lưu được — kiểm tra kết nối");
  };

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

      <SnapshotBanner />

      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <Link
          to="/vendors"
          className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/30"
        >
          <Store className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Nhà cung cấp</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Thêm, sửa vendor mặc định và thường dùng khi ghi chi tiêu.
            </p>
          </div>
        </Link>

        <Link
          to="/reminders"
          className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/30"
        >
          <Bell className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Lịch nhắc</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Tạo chi tiêu định kỳ và xem ngày nhắc tiếp theo.
            </p>
          </div>
        </Link>

        <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-foreground">
            <HardDrive className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Bản sao trên máy</h2>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            JSON lưu trên thiết bị này. Bản “hôm qua” không bị ghi đè trong ngày, phòng khi mất kết nối Supabase.
          </p>
          <div className="space-y-1.5 text-xs">
            <p>
              <span className="text-muted-foreground">Hôm nay · </span>
              <span className="text-foreground">{metaLine(todayMeta, "Chưa có")}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Một ngày trước · </span>
              <span className="text-foreground">{metaLine(yesterdayMeta, "Chưa có")}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={backupNow}
              disabled={saving}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
            >
              {saving ? "Đang sao lưu…" : "Sao lưu ngay"}
            </button>
            <button
              type="button"
              onClick={() => downloadSlot("today")}
              disabled={!todayMeta}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-40"
            >
              <Download className="h-3 w-3" />
              Tải hôm nay
            </button>
            <button
              type="button"
              onClick={() => downloadSlot("yesterday")}
              disabled={!yesterdayMeta}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-40"
            >
              <Download className="h-3 w-3" />
              Tải hôm qua
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-foreground">
            <Palette className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Ba số 0 cuối</h2>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            Cách hiện 450.000₫ trên danh sách và ô nhập: k, nghìn, hoặc ẩn hẳn.
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {THOUSANDS_SUFFIX_OPTIONS.map(option => {
              const on = mode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setMode(option.id)}
                  aria-pressed={on}
                  className={`rounded-xl border px-2 py-2 text-center transition-colors ${
                    on
                      ? "border-primary/45 bg-primary/10 text-foreground"
                      : "border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/25 hover:text-foreground"
                  }`}
                >
                  <span className="block text-sm font-semibold leading-tight">{option.label}</span>
                  <span className="mt-0.5 block text-[10px] tabular-nums opacity-80">{option.sample}</span>
                </button>
              );
            })}
          </div>
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
