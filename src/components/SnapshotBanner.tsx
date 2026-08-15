import { HardDrive } from "lucide-react";
import { useLaggedSnapshot } from "@/hooks/useLaggedSnapshot";
import { formatDayMonth } from "@/lib/formatDateVi";
import { parseISO } from "date-fns";

export default function SnapshotBanner() {
  const { mode, fallback } = useLaggedSnapshot();
  if (mode !== "today" && mode !== "yesterday") return null;

  const when = fallback?.localDate
    ? formatDayMonth(parseISO(fallback.localDate))
    : null;
  const label =
    mode === "yesterday"
      ? `Mất kết nối · đang dùng bản sao một ngày trước${when ? ` (${when})` : ""}`
      : `Mất kết nối · đang dùng bản trên máy${when ? ` (${when})` : ""}`;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 flex items-center gap-2">
      <HardDrive className="h-3.5 w-3.5 shrink-0 text-amber-700" />
      <p className="min-w-0 text-[11px] leading-snug text-amber-900/90">{label}. Ghi mới cần kết nối lại.</p>
    </div>
  );
}
