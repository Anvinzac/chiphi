import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, Check, Copy, Delete, LayoutGrid, Search, X } from "lucide-react";
import { addDays, format, isValid, parseISO } from "date-fns";
import { toast } from "sonner";
import MonthlyOrderGrid, { type MonthlyOrderCol } from "@/components/orders/MonthlyOrderGrid";
import MonthlyOrderTwoColPager from "@/components/orders/MonthlyOrderTwoColPager";
import { mockMonthlyOrderByDate } from "@/lib/mockMonthlyOrderGrid";
import type { MonthlyOrderLine } from "@/lib/mockMonthlyOrderGrid";
import { googleSumExpr } from "@/lib/googleSumExpr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const POPOVER_W = 280;
const POPOVER_H = 310;
const GAP = 10;

type AnchorInfo = {
  rect: DOMRect;
  row: number;
  col: number;
  columns: number;
} | null;

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

  const baseItems = useMemo(() => mockMonthlyOrderByDate(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const [overrides, setOverrides] = useState<Map<string, MonthlyOrderLine[]>>(new Map());
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [anchor, setAnchor] = useState<AnchorInfo>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; arrow: "top" | "left" | "right"; arrowOffset: number } | null>(null);
  // Range picker state: single global range with default values 16-24
  const [rangeMin, setRangeMin] = useState("16");
  const [rangeMax, setRangeMax] = useState("24");
  // State for range editor dialog
  const [rangeEditorOpen, setRangeEditorOpen] = useState(false);
  // Track if user has started typing (to hide range pills)
  const [hasStartedTyping, setHasStartedTyping] = useState(false);

  const itemsByDate = useMemo(() => {
    const m = new Map(baseItems);
    for (const [k, v] of overrides) {
      if (m.has(k)) m.set(k, v);
    }
    return m;
  }, [baseItems, overrides]);

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

  const handleDayClick = (info: { dateStr: string; rect: DOMRect; row: number; col: number; columns: number }) => {
    const lines = itemsByDate.get(info.dateStr) ?? [];
    const current = lines.length > 0 ? lines[0].num : "";
    setEditingDate(info.dateStr);
    setEditingValue(current);
    setAnchor({ rect: info.rect, row: info.row, col: info.col, columns: info.columns });
    setHasStartedTyping(current !== "");
  };

  const closeNumpad = () => {
    setEditingDate(null);
    setEditingValue("");
    setAnchor(null);
    setPopoverPos(null);
    setHasStartedTyping(false);
  };

  // Select a value from the range and hide the range display
  const selectRangeValue = (value: number) => {
    if (!editingDate) return;
    setEditingValue(String(value));
    setHasStartedTyping(true);
    // Don't close the numpad - just hide the range and let user continue with custom input
  };

  // Get range values from global range settings
  const currentRange = useMemo(() => {
    const min = parseInt(rangeMin) || 0;
    const max = parseInt(rangeMax) || 0;
    if (min <= 0 || max <= 0 || min >= max) return null;
    // Generate array of numbers from min to max
    const values: number[] = [];
    for (let i = min; i <= max; i++) {
      values.push(i);
    }
    return values;
  }, [rangeMin, rangeMax]);

  // Compute popover position: top row -> below, lower rows -> sideways
  useEffect(() => {
    if (!editingDate || !anchor) {
      setPopoverPos(null);
      return;
    }
    const compute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rect = anchor.rect;
      const isTopRow = anchor.row === 0;
      if (isTopRow) {
        // Below cell
        let left = rect.left + rect.width / 2 - POPOVER_W / 2;
        left = Math.max(8, Math.min(left, vw - POPOVER_W - 8));
        let top = rect.bottom + GAP;
        // If not enough space below, flip above (rare for top row)
        if (top + POPOVER_H > vh - 8) top = rect.top - POPOVER_H - GAP;
        top = Math.max(8, Math.min(top, vh - POPOVER_H - 8));
        const arrowOffset = rect.left + rect.width / 2 - left;
        setPopoverPos({ top, left, arrow: "top", arrowOffset: Math.max(12, Math.min(POPOVER_W - 12, arrowOffset)) });
      } else {
        // Sideways: left col -> right, right col -> left
        const showRight = anchor.col < anchor.columns / 2;
        let top = rect.top + rect.height / 2 - POPOVER_H / 2;
        top = Math.max(8, Math.min(top, vh - POPOVER_H - 8));
        let left: number;
        let arrow: "left" | "right";
        if (showRight) {
          left = rect.right + GAP;
          if (left + POPOVER_W > vw - 8) left = rect.left - POPOVER_W - GAP; // fallback flip
          arrow = "left";
        } else {
          left = rect.left - POPOVER_W - GAP;
          if (left < 8) left = rect.right + GAP;
          arrow = "right";
        }
        left = Math.max(8, Math.min(left, vw - POPOVER_W - 8));
        const arrowOffset = rect.top + rect.height / 2 - top;
        setPopoverPos({ top, left, arrow, arrowOffset: Math.max(12, Math.min(POPOVER_H - 12, arrowOffset)) });
      }
    };
    compute();
    const onResize = () => compute();
    const onScroll = () => closeNumpad();
    window.addEventListener("resize", onResize);
    // Close on scroll of any scrollable parent (grid scroller)
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [editingDate, anchor]);

  const handleDigit = (d: string) => {
    setEditingValue(prev => {
      if (prev.length >= 4) return prev;
      if (prev === "0") return d;
      const next = prev + d;
      if (prev === "" && !hasStartedTyping) {
        setHasStartedTyping(true);
      }
      return next;
    });
  };

  const handleBackspace = () => {
    setEditingValue(prev => {
      const next = prev.slice(0, -1);
      if (next === "") {
        setHasStartedTyping(false);
      }
      return next;
    });
  };
  const handleClear = () => {
    setEditingValue("");
    setHasStartedTyping(false);
  };
  const handleSave = () => {
    if (!editingDate) return;
    const v = editingValue.trim();
    const next: MonthlyOrderLine[] = v === "" ? [] : [{ num: v.replace(/^0+(?=\d)/, "") || "0" }];
    setOverrides(prev => {
      const m = new Map(prev);
      m.set(editingDate, next);
      return m;
    });
    closeNumpad();
  };
  const handleDelete = () => {
    if (!editingDate) return;
    setOverrides(prev => {
      const m = new Map(prev);
      m.set(editingDate, []);
      return m;
    });
    closeNumpad();
  };

  useEffect(() => {
    if (!editingDate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNumpad();
      if (e.key === "Enter") handleSave();
      if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    // Don't lock body for inline popover — keep grid scrollable but backdrop handles close
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [editingDate, editingValue]);

  const hasInvalidRange = !parsed;

  const openPicker = (ref: React.RefObject<HTMLInputElement>) => {
    const el = ref.current;
    if (!el) return;
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
          <button
            type="button"
            onClick={() => setRangeEditorOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-1.5 ml-2 text-[11px] font-medium leading-none hover:bg-muted/60 transition-colors"
            style={{ width: "30%" }}
            aria-label="Chỉnh dãy số"
          >
            <LayoutGrid className="h-3 w-3 opacity-70" />
            {rangeMin}–{rangeMax}
          </button>
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
        {/* Bottom total bar — with tappable total */}
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

      {/* Inline numpad popover — anchored to tapped cell with arrow */}
      {editingDate && popoverPos && (
        <>
          <button type="button" aria-label="Đóng bàn phím" onClick={closeNumpad} className="fixed inset-0 z-40 bg-black/10" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Sửa số ngày ${editingDate}`}
            className="fixed z-50 flex w-[280px] flex-col rounded-2xl border bg-card shadow-[0_8px_30px_-8px_rgba(0,0,0,0.22)]"
            style={{ top: popoverPos.top, left: popoverPos.left }}
          >
            {/* Arrow — no outline, adjacent to panel */}
            <div
              aria-hidden
              className="absolute h-3 w-3 rotate-45 bg-card"
              style={
                popoverPos.arrow === "top"
                  ? { top: -6, left: popoverPos.arrowOffset - 6 }
                  : popoverPos.arrow === "left"
                    ? { left: -6, top: popoverPos.arrowOffset - 6 }
                    : { right: -6, top: popoverPos.arrowOffset - 6 }
              }
            />
            <div className="flex items-center justify-between px-3 pb-1 pt-3">
              <span className="text-xs font-semibold tabular-nums">
                {editingDate ? format(parseISO(editingDate), "EEEE, d 'th' M") : ""}
              </span>
              <button
                type="button"
                onClick={closeNumpad}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Đóng"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Range values display - shown covering the main field, hidden when typing starts */}
            {currentRange && currentRange.length > 0 && !hasStartedTyping && (
              <div
                className="mx-3 mb-2 grid grid-flow-row grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1 pb-1 transition-all duration-200 ease-out"
                onScroll={e => e.stopPropagation()}
              >
                {currentRange.map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => selectRangeValue(val)}
                    className="rounded-lg border border-border/60 bg-card px-2 py-1 text-sm font-medium tabular-nums shadow-sm hover:bg-muted active:scale-95"
                  >
                    {val}
                  </button>
                ))}
              </div>
            )}

            <div className="mx-3 flex h-10 items-center justify-center rounded-xl border bg-muted/30 px-3 text-xl font-bold tabular-nums transition-all duration-200 ease-out">
              {editingValue !== "" ? editingValue : <span className="text-muted-foreground/40 text-sm">— trống —</span>}
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-3 pb-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDigit(d)}
                  className="keypad-key rounded-xl border border-border/60 bg-card py-2 text-base font-medium shadow-sm active:scale-95"
                  style={{ minHeight: "2.5rem" }}
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="keypad-key rounded-xl border border-border/60 bg-muted/40 py-2 text-xs font-medium text-muted-foreground"
                style={{ minHeight: "2.5rem" }}
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleDigit("0")}
                className="keypad-key rounded-xl border border-border/60 bg-card py-2 text-base font-medium shadow-sm active:scale-95"
                style={{ minHeight: "2.5rem" }}
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="keypad-key rounded-xl border border-border/60 bg-muted/40 py-2 text-muted-foreground active:scale-95"
                style={{ minHeight: "2.5rem" }}
                aria-label="Xóa"
              >
                <Delete className="mx-auto h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-xl border border-destructive/30 bg-destructive/5 py-2.5 text-xs font-medium text-destructive hover:bg-destructive/10"
              >
                Xóa
              </button>
              <button
                type="button"
                onClick={closeNumpad}
                className="rounded-xl border border-border bg-background py-2.5 text-xs font-medium hover:bg-muted"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                <Check className="h-3.5 w-3.5" />
                Lưu
              </button>
            </div>
          </div>
        </>
      )}

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

      {/* Range editor dialog */}
      <Dialog open={rangeEditorOpen} onOpenChange={setRangeEditorOpen}>
        <DialogContent className="max-w-[90vw] rounded-xl sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">Dãy số</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1">Từ</label>
                <Input
                  type="number"
                  value={rangeMin}
                  onChange={e => setRangeMin(e.target.value)}
                  placeholder="16"
                  className="h-9 text-sm"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Đến</label>
                <Input
                  type="number"
                  value={rangeMax}
                  onChange={e => setRangeMax(e.target.value)}
                  placeholder="24"
                  className="h-9 text-sm"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRangeEditorOpen(false)} className="flex-1">
              Hủy
            </Button>
            <Button size="sm" onClick={() => setRangeEditorOpen(false)} className="flex-1">
              Lưu
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
