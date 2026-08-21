import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, Copy, LayoutGrid, Search } from "lucide-react";
import { addDays, format, isValid, parseISO } from "date-fns";
import { toast } from "sonner";
import MonthlyOrderGrid, { type MonthlyOrderCol } from "@/components/orders/MonthlyOrderGrid";
import MonthlyOrderTwoColPager from "@/components/orders/MonthlyOrderTwoColPager";
import { mockMonthlyOrderByDate } from "@/lib/mockMonthlyOrderGrid";
import { googleSumExpr } from "@/lib/googleSumExpr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function toInputValue(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseInputValue(v: string): Date | null {
  if (!v) return null;
  const d = parseISO(v);
  return isValid(d) ? d : null;
}

function clampRange(start: Date, end: Date): { start: Date; end: Date } {
  if (start > end) return { start: end, end: start };
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (diff > 60) return { start, end: addDays(start, 59) };
  return { start, end };
}

function shortVi(d: Date): string {
  return format(d, "d 'th' M");
}

const COL_OPTIONS: { value: MonthlyOrderCol; label: string }[] = [
  { value: 2, label: "2 cột" },
  { value: 3, label: "3 cột" },
  { value: 4, label: "4 cột" },
];

export default function MonthlyOrder() {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toInputValue(today), [today]);

  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  }, []);
  const defaultEnd = useMemo(() => {
    const d = new Date(defaultStart);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d;
  }, [defaultStart]);

  const [startInput, setStartInput] = useState(() => toInputValue(defaultStart));
  const [endInput, setEndInput] = useState(() => toInputValue(defaultEnd));
  const [columns, setColumns] = useState<MonthlyOrderCol>(4);
  const [totalOpen, setTotalOpen] = useState(false);

  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    const s = parseInputValue(startInput);
    const e = parseInputValue(endInput);
    if (!s || !e) return null;
    return clampRange(s, e);
  }, [startInput, endInput]);

  const rangeStart = parsed?.start ?? defaultStart;
  const rangeEnd = parsed?.end ?? defaultEnd;
  const dayCount = useMemo(
    () => Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    [rangeStart, rangeEnd],
  );

  const itemsByDate = useMemo(
    () => mockMonthlyOrderByDate(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );

  const stats = useMemo(() => {
    let daysWithItems = 0;
    let totalLines = 0;
    let totalSum = 0;
    const dayTotals: { key: string; name: string; amount: number }[] = [];
    for (const [dateStr, lines] of itemsByDate) {
      if (lines.length > 0) daysWithItems++;
      totalLines += lines.length;
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
    return { daysWithItems, totalLines, totalSum, dayTotals };
  }, [itemsByDate]);
  const googleExpr = googleSumExpr(stats.dayTotals);

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

  const setPreset = (kind: "month" | "30d" | "next30") => {
    if (kind === "month") {
      const s = new Date();
      s.setDate(1);
      const e = new Date(s);
      e.setMonth(e.getMonth() + 1);
      e.setDate(0);
      setStartInput(toInputValue(s));
      setEndInput(toInputValue(e));
    } else if (kind === "30d") {
      const e = new Date();
      const s = addDays(e, -29);
      setStartInput(toInputValue(s));
      setEndInput(toInputValue(e));
    } else {
      const s = new Date();
      const e = addDays(s, 29);
      setStartInput(toInputValue(s));
      setEndInput(toInputValue(e));
    }
  };

  const handleDayClick = (dateStr: string) => {
    const lines = itemsByDate.get(dateStr);
    if (!lines || lines.length === 0) {
      toast.message(`${dateStr}: không có món`);
      return;
    }
    toast.message(`${dateStr}: ${lines[0].num}`);
  };

  const hasInvalidRange = !parsed;

  const openPicker = (ref: React.RefObject<HTMLInputElement>) => {
    const el = ref.current;
    if (!el) return;
    // modern browsers
    const anyEl = el as unknown as { showPicker?: () => void };
    if (typeof anyEl.showPicker === "function") {
      try {
        anyEl.showPicker();
        return;
      } catch {
        /* fallback */
      }
    }
    el.click();
    el.focus();
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/95 px-3 py-3 backdrop-blur-sm sm:px-4">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <Link
            to="/orders"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Quay lại Đặt hàng"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 font-display text-[17px] leading-tight text-foreground sm:text-xl">
              <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
              Đơn tháng
            </h1>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {hasInvalidRange ? "Chọn ngày bắt đầu và kết thúc" : `${shortVi(rangeStart)} – ${shortVi(rangeEnd)} · ${dayCount} ngày`}
            </p>
          </div>
          <div
            className="inline-flex shrink-0 rounded-full border border-border/60 bg-muted/40 p-0.5"
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
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium leading-none transition-colors sm:px-3 sm:text-xs ${
                    active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="h-3 w-3 opacity-70" />
                  {opt.value}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Controls: custom short pills */}
      <div className="shrink-0 border-b border-border/50 bg-card/70 px-3 py-2.5 sm:px-4">
        <div className="mx-auto max-w-lg space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="min-w-0 space-y-1">
              <span className="block pl-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Từ ngày
              </span>
              <button
                type="button"
                onClick={() => openPicker(startRef)}
                className="flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-left shadow-sm transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                aria-label="Chọn ngày bắt đầu"
              >
                <span className="min-w-0 truncate text-sm font-semibold tabular-nums">
                  {hasInvalidRange ? "—" : shortVi(rangeStart)}
                </span>
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
              <input
                ref={startRef}
                type="date"
                value={startInput}
                onChange={e => setStartInput(e.target.value)}
                max={endInput || undefined}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
              />
            </div>
            <div className="min-w-0 space-y-1">
              <span className="block pl-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Đến ngày
              </span>
              <button
                type="button"
                onClick={() => openPicker(endRef)}
                className="flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-left shadow-sm transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                aria-label="Chọn ngày kết thúc"
              >
                <span className="min-w-0 truncate text-sm font-semibold tabular-nums">
                  {hasInvalidRange ? "—" : shortVi(rangeEnd)}
                </span>
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
              <input
                ref={endRef}
                type="date"
                value={endInput}
                onChange={e => setEndInput(e.target.value)}
                min={startInput || undefined}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPreset("month")}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              Tháng này
            </button>
            <button
              type="button"
              onClick={() => setPreset("30d")}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              30 ngày qua
            </button>
            <button
              type="button"
              onClick={() => setPreset("next30")}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              30 ngày tới
            </button>
            <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/70">
              {dayCount} ngày · {stats.daysWithItems} có số
            </span>
          </div>

          {hasInvalidRange && (
            <p className="text-[11px] text-destructive">Ngày không hợp lệ — kiểm tra định dạng YYYY-MM-DD</p>
          )}
          {dayCount > 60 && (
            <p className="text-[11px] text-amber-600">Khoảng tối đa 60 ngày — đã tự cắt cho dễ xem.</p>
          )}
        </div>
      </div>

      {/* Viewport-fit grid — 2-col is week-paged vertical */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        {hasInvalidRange ? (
          <div className="flex flex-1 items-center justify-center px-4 py-12 text-center text-sm text-muted-foreground">
            Chọn ngày hợp lệ để xem lưới đơn tháng.
          </div>
        ) : columns === 2 ? (
          <MonthlyOrderTwoColPager
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            itemsByDate={itemsByDate}
            todayStr={todayStr}
            onSelectDay={handleDayClick}
          />
        ) : (
          <MonthlyOrderGrid
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            columns={columns}
            itemsByDate={itemsByDate}
            todayStr={todayStr}
            onSelectDay={handleDayClick}
          />
        )}
        {/* Bottom total bar — replaces wasted notice */}
        <div className="relative flex shrink-0 items-center border-t border-border bg-card px-3 py-2.5 sm:px-4">
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tổng</span>
          <button
            type="button"
            disabled={hasInvalidRange}
            onClick={() => setTotalOpen(true)}
            className="total-amount-hit absolute left-1/2 -translate-x-1/2 hover:bg-muted/50 disabled:pointer-events-none"
            aria-label="Xem chi tiết tổng"
          >
            <span className="text-lg font-display font-bold leading-none tabular-nums">
              {hasInvalidRange ? "—" : stats.totalSum}
            </span>
          </button>
          <span className="ml-auto shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
            {hasInvalidRange ? "" : `${stats.daysWithItems}/${dayCount} ngày`}
          </span>
        </div>
      </div>

      <Dialog open={totalOpen} onOpenChange={setTotalOpen}>
        <DialogContent className="max-w-[92vw] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Chi tiết tổng</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-0.5">
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
            <p className="break-all font-mono text-[11px] leading-snug text-muted-foreground">{googleExpr}</p>
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
