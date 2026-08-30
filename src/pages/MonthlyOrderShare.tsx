import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Copy, HelpCircle, LayoutGrid, Search } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { toast } from "sonner";
import MonthlyOrderGrid, { type MonthlyOrderCol } from "@/components/orders/MonthlyOrderGrid";
import MonthlyOrderTwoColPager from "@/components/orders/MonthlyOrderTwoColPager";
import MoneyLabel from "@/components/daily/MoneyLabel";
import ThousandsMark from "@/components/daily/ThousandsMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEFAULT_MONTHLY_PIN, overridesFromCells } from "@/lib/monthlyOrderPersist";
import { emptyMonthlyOrderByDate } from "@/lib/mockMonthlyOrderGrid";
import { fetchSharedMonthlyOrder, saveSharedMonthlyNotice, type SharedMonthlyOrder } from "@/lib/monthlyOrderDb";
import { isOrderPinUnlocked, markOrderPinUnlocked } from "@/lib/orderShare";
import { googleSumExpr } from "@/lib/googleSumExpr";
import { vndFromThousands } from "@/lib/vndThousands";

function shortVi(d: Date): string {
  return format(d, "d 'th' M");
}

const UNIT_PRICE_NUM_CLASS =
  "font-display text-base font-bold leading-none tabular-nums sm:text-lg";

const COL_OPTIONS: { value: MonthlyOrderCol; label: string }[] = [
  { value: 2, label: "2 cột" },
  { value: 3, label: "3 cột" },
  { value: 4, label: "4 cột" },
  { value: 7, label: "7 cột" },
];

export default function MonthlyOrderShare() {
  const { token = "" } = useParams();
  const [pin, setPin] = useState(DEFAULT_MONTHLY_PIN);
  const [unlocking, setUnlocking] = useState(false);
  const [order, setOrder] = useState<SharedMonthlyOrder | null>(null);
  const [unlocked, setUnlocked] = useState(() => (token ? isOrderPinUnlocked(`m:${token}`) : false));
  const [columns, setColumns] = useState<MonthlyOrderCol>(4);
  const [totalOpen, setTotalOpen] = useState(false);
  const [vendorNotice, setVendorNotice] = useState("");
  const noticeReadyRef = useRef(false);
  const noticePinRef = useRef(DEFAULT_MONTHLY_PIN);
  const noticeRef = useRef<HTMLTextAreaElement>(null);
  const [noticeLines, setNoticeLines] = useState(1);
  const [noticeAnimOn, setNoticeAnimOn] = useState(false);

  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const rangeStart = useMemo(() => (order ? parseISO(order.rangeStart) : null), [order]);
  const rangeEnd = useMemo(() => (order ? parseISO(order.rangeEnd) : null), [order]);
  const hasValidRange = !!(rangeStart && rangeEnd && isValid(rangeStart) && isValid(rangeEnd));

  const dayCount = useMemo(() => {
    if (!hasValidRange || !rangeStart || !rangeEnd) return 0;
    return Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [hasValidRange, rangeStart, rangeEnd]);

  const itemsByDate = useMemo(() => {
    if (!order || !hasValidRange || !rangeStart || !rangeEnd) return new Map();
    const empty = emptyMonthlyOrderByDate(rangeStart, rangeEnd);
    const overrides = overridesFromCells(order.cells);
    for (const [date, lines] of overrides) {
      if (empty.has(date)) empty.set(date, lines);
    }
    return empty;
  }, [order, hasValidRange, rangeStart, rangeEnd]);

  const stats = useMemo(() => {
    let daysWithItems = 0;
    let totalSum = 0;
    const dayTotals: { key: string; name: string; amount: number }[] = [];
    for (const [dateStr, lines] of itemsByDate) {
      if (lines.length > 0) daysWithItems++;
      for (const l of lines) {
        const amount = Number(l.num) || 0;
        if (!amount) continue;
        totalSum += amount;
        const d = parseISO(dateStr);
        dayTotals.push({
          key: `${dateStr}-${l.num}`,
          name: isValid(d) ? shortVi(d) : dateStr,
          amount,
        });
      }
    }
    return { daysWithItems, totalSum, dayTotals };
  }, [itemsByDate]);

  const googleExpr = googleSumExpr(stats.dayTotals);
  const unitPriceDraft = order?.unitPriceDraft || "";
  const unitPriceVnd = vndFromThousands(unitPriceDraft);
  const moneyTotal = unitPriceVnd > 0 ? stats.totalSum * unitPriceVnd : 0;

  const copyMonthTotal = async () => {
    try {
      await navigator.clipboard.writeText(String(stats.totalSum));
      toast.success("Đã sao chép tổng");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Không copy được");
    }
  };

  const searchTotalOnGoogle = () => {
    const q = googleExpr || String(stats.totalSum);
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(q)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

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
      noticePinRef.current = pin.trim() || DEFAULT_MONTHLY_PIN;
      noticeReadyRef.current = false;
      setVendorNotice(next.vendorNotice || "");
      setOrder(next);
      setColumns(next.columns);
      setUnlocked(true);
      window.setTimeout(() => {
        noticeReadyRef.current = true;
      }, 0);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Không mở được đơn tháng");
    } finally {
      setUnlocking(false);
    }
  };

  useEffect(() => {
    if (!noticeReadyRef.current || !token || !order) return;
    const t = window.setTimeout(() => {
      void saveSharedMonthlyNotice(token, noticePinRef.current, vendorNotice).catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Không lưu được ghi chú");
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [vendorNotice, token, order]);

  useLayoutEffect(() => {
    const el = noticeRef.current;
    if (!el) return;
    const line = Number.parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = "auto";
    const next = Math.min(3, Math.max(1, Math.ceil(el.scrollHeight / line - 0.12)));
    el.style.height = "";
    setNoticeLines(prev => (prev === next ? prev : next));
    if (!noticeAnimOn) {
      const id = requestAnimationFrame(() => setNoticeAnimOn(true));
      return () => cancelAnimationFrame(id);
    }
  }, [vendorNotice, unlocked, noticeAnimOn]);

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

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/95 px-3 py-3 backdrop-blur-sm sm:px-4">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <span className="inline-flex h-9 w-9 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 max-w-full items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
              <h1 className="min-w-0 truncate font-display text-[17px] leading-tight text-foreground sm:text-xl">
                {order.title}
              </h1>
            </div>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {hasValidRange && rangeStart && rangeEnd
                ? `${shortVi(rangeStart)} – ${shortVi(rangeEnd)} · ${dayCount} ngày`
                : "Ngày không hợp lệ"}
            </p>
          </div>
          <span className="inline-flex h-9 w-9 shrink-0" aria-hidden />
        </div>
      </div>

      <div className="shrink-0 border-b border-border/50 bg-card/70 px-3 py-2.5 sm:px-4">
        <div className="mx-auto max-w-lg">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="min-w-0 space-y-1">
              <span className="block pl-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Từ ngày
              </span>
              <div className="flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-border bg-background px-3 py-2 shadow-sm">
                <span className="min-w-0 truncate text-sm font-semibold tabular-nums">
                  {hasValidRange && rangeStart ? shortVi(rangeStart) : "—"}
                </span>
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </div>
            </div>
            <div className="min-w-0 space-y-1">
              <span className="block pl-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Đến ngày
              </span>
              <div className="flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-border bg-background px-3 py-2 shadow-sm">
                <span className="min-w-0 truncate text-sm font-semibold tabular-nums">
                  {hasValidRange && rangeEnd ? shortVi(rangeEnd) : "—"}
                </span>
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center border-b border-border/50 bg-background px-4 py-2.5">
        <div
          className="flex w-[80%] max-w-sm rounded-full border border-border/60 bg-muted/40 p-1"
          role="tablist"
          aria-label="Số cột"
        >
          {COL_OPTIONS.map(opt => {
            const active = columns === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setColumns(opt.value)}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium leading-none transition-colors ${
                  active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5 opacity-70" />
                {opt.value}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        {!hasValidRange || !rangeStart || !rangeEnd ? (
          <div className="flex flex-1 items-center justify-center px-4 py-12 text-center text-sm text-muted-foreground">
            Ngày không hợp lệ — không xem được lưới.
          </div>
        ) : columns === 2 ? (
          <MonthlyOrderTwoColPager
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            itemsByDate={itemsByDate}
            todayStr={todayStr}
          />
        ) : (
          <MonthlyOrderGrid
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            columns={columns}
            itemsByDate={itemsByDate}
            todayStr={todayStr}
          />
        )}

        <div
          role="button"
          tabIndex={hasValidRange ? 0 : -1}
          onClick={() => hasValidRange && setTotalOpen(true)}
          onKeyDown={e => {
            if (!hasValidRange) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setTotalOpen(true);
            }
          }}
          className="flex min-h-12 shrink-0 cursor-pointer items-center border-t border-border bg-card hover:bg-muted/30"
          aria-label="Xem chi tiết tổng"
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch px-3 py-2 sm:px-4">
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Tổng
              <HelpCircle className="h-3.5 w-3.5" strokeWidth={2.1} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-1.5">
              <span className={`leading-none ${UNIT_PRICE_NUM_CLASS}`}>
                {hasValidRange ? stats.totalSum : "—"}
              </span>
              <span className="shrink-0 text-muted-foreground/45" aria-hidden>
                ×
              </span>
              <span className="monthly-unit-price inline-flex shrink-0 items-baseline rounded-md border border-border/70 bg-background px-1.5 py-0.5">
                <span className={`${UNIT_PRICE_NUM_CLASS} ${unitPriceDraft ? "" : "font-medium text-muted-foreground/40"}`}>
                  {unitPriceDraft || "giá"}
                </span>
                {unitPriceDraft ? (
                  <ThousandsMark className="text-[0.7em] font-display font-bold leading-none text-muted-foreground/70" />
                ) : null}
              </span>
              {unitPriceVnd > 0 && hasValidRange ? (
                <>
                  <span className="shrink-0 text-muted-foreground/45" aria-hidden>
                    =
                  </span>
                  <MoneyLabel
                    amount={moneyTotal}
                    className="min-w-0 truncate text-base font-display font-bold leading-none sm:text-lg"
                    smallClassName="text-[0.7em]"
                  />
                </>
              ) : null}
            </span>
          </div>
          <label
            className="flex w-[30%] min-w-0 shrink-0 items-center border-l border-border/60 px-2 py-1.5 sm:px-3"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
          >
            <span
              className={`monthly-vendor-notice-shell${noticeAnimOn ? " monthly-vendor-notice-shell--live" : ""}`}
              style={{ ["--notice-lines" as string]: noticeLines }}
            >
              <textarea
                ref={noticeRef}
                rows={1}
                value={vendorNotice}
                onChange={e => setVendorNotice(e.target.value.slice(0, 200))}
                onClick={e => e.stopPropagation()}
                placeholder="Ghi chú…"
                aria-label="Ghi chú cho đơn tháng"
                className="monthly-vendor-notice bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/45"
              />
            </span>
          </label>
        </div>
      </div>

      <Dialog open={totalOpen} onOpenChange={setTotalOpen}>
        <DialogContent className="max-w-[94vw] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Chi tiết tổng</DialogTitle>
          </DialogHeader>
          <div className="monthly-total-detail__list space-y-1">
            {stats.dayTotals.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">Chưa có số nào trong khoảng này</p>
            ) : (
              stats.dayTotals.map(line => (
                <div key={line.key} className="flex items-center justify-between gap-3 py-1.5">
                  <p className="min-w-0 truncate text-sm">{line.name}</p>
                  <span className="shrink-0 text-sm tabular-nums">{line.amount}</span>
                </div>
              ))
            )}
          </div>
          {googleExpr ? (
            <p className="monthly-total-detail__expr break-all font-mono text-[11px] leading-snug text-muted-foreground">
              {googleExpr}
            </p>
          ) : null}
          <div className="flex items-end justify-between gap-2 border-t border-border/50 pt-3">
            <button
              type="button"
              onClick={() => void copyMonthTotal()}
              className="min-w-0 rounded-lg px-1 py-0.5 text-left hover:bg-muted/50"
              aria-label="Sao chép tổng"
            >
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Tổng
                <Copy className="h-3 w-3" strokeWidth={2.4} />
              </span>
              <span className="text-xl font-display font-bold tabular-nums">{stats.totalSum}</span>
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={!googleExpr && stats.totalSum <= 0}
              onClick={searchTotalOnGoogle}
            >
              <Search className="h-3.5 w-3.5" strokeWidth={2.4} />
              Google
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
