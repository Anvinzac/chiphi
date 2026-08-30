import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { toast } from "sonner";
import MonthlyOrderGrid from "@/components/orders/MonthlyOrderGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_MONTHLY_PIN, overridesFromCells } from "@/lib/monthlyOrderPersist";
import { emptyMonthlyOrderByDate } from "@/lib/mockMonthlyOrderGrid";
import { fetchSharedMonthlyOrder, type SharedMonthlyOrder } from "@/lib/monthlyOrderDb";
import { isOrderPinUnlocked, markOrderPinUnlocked } from "@/lib/orderShare";

export default function MonthlyOrderShare() {
  const { token = "" } = useParams();
  const [pin, setPin] = useState(DEFAULT_MONTHLY_PIN);
  const [unlocking, setUnlocking] = useState(false);
  const [order, setOrder] = useState<SharedMonthlyOrder | null>(null);
  const [unlocked, setUnlocked] = useState(() => (token ? isOrderPinUnlocked(`m:${token}`) : false));

  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const itemsByDate = useMemo(() => {
    if (!order) return new Map();
    const start = parseISO(order.rangeStart);
    const end = parseISO(order.rangeEnd);
    if (!isValid(start) || !isValid(end)) return new Map();
    const empty = emptyMonthlyOrderByDate(start, end);
    const overrides = overridesFromCells(order.cells);
    for (const [date, lines] of overrides) {
      if (empty.has(date)) empty.set(date, lines);
    }
    return empty;
  }, [order]);

  const unlock = async () => {
    if (!token) return;
    setUnlocking(true);
    try {
      const next = await fetchSharedMonthlyOrder(token, pin.trim() || DEFAULT_MONTHLY_PIN);
      if (!next) {
        toast.error("PIN sai hoặc link không còn");
        return;
      }
      markOrderPinUnlocked(`m:${token}`);
      setOrder(next);
      setUnlocked(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Không mở được đơn tháng");
    } finally {
      setUnlocking(false);
    }
  };

  if (!unlocked || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <CalendarDays className="mx-auto h-6 w-6 text-primary" />
            <h1 className="mt-2 font-display text-xl">Đơn tháng</h1>
            <p className="mt-1 text-xs text-muted-foreground">Nhập PIN để xem lưới</p>
          </div>
          <Input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder={DEFAULT_MONTHLY_PIN}
            className="h-11 text-center text-lg tracking-[0.3em]"
            onKeyDown={e => e.key === "Enter" && void unlock()}
          />
          <Button type="button" className="w-full" disabled={unlocking || !token} onClick={() => void unlock()}>
            {unlocking ? "Đang mở…" : "Mở khóa"}
          </Button>
        </div>
      </div>
    );
  }

  const start = parseISO(order.rangeStart);
  const end = parseISO(order.rangeEnd);

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background">
      <div className="border-b border-border/60 px-4 py-3">
        <h1 className="font-display text-lg text-foreground">{order.title}</h1>
        <p className="text-[11px] text-muted-foreground">
          {format(start, "d/M")} – {format(end, "d/M")}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <MonthlyOrderGrid
          rangeStart={start}
          rangeEnd={end}
          columns={order.columns === 2 ? 4 : order.columns}
          itemsByDate={itemsByDate}
          todayStr={todayStr}
        />
      </div>
    </div>
  );
}
