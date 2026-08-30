import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, Check, Copy, Delete, GripHorizontal, Hash, LayoutGrid, Search, Share2, X } from "lucide-react";
import { addDays, format, isValid, parseISO } from "date-fns";
import { toast } from "sonner";
import MonthlyOrderGrid, { type MonthlyOrderCol } from "@/components/orders/MonthlyOrderGrid";
import MonthlyOrderTwoColPager from "@/components/orders/MonthlyOrderTwoColPager";
import MonthBoundCalendar from "@/components/daily/MonthBoundCalendar";
import MoneyLabel from "@/components/daily/MoneyLabel";
import ClearFieldButton from "@/components/daily/ClearFieldButton";
import ThousandsMark from "@/components/daily/ThousandsMark";
import { emptyMonthlyOrderByDate } from "@/lib/mockMonthlyOrderGrid";
import type { MonthlyOrderLine } from "@/lib/mockMonthlyOrderGrid";
import {
  DEFAULT_MONTHLY_PIN,
  cellsFromOverrides,
  monthlyShareUrl,
  overridesFromCells,
  readMonthlyOrderLocal,
  writeMonthlyOrderLocal,
} from "@/lib/monthlyOrderPersist";
import { loadMonthlyOrderRemote, saveMonthlyOrderRemote } from "@/lib/monthlyOrderDb";
import { generateShareToken, hashPin } from "@/lib/orderShare";
import { useAuth } from "@/hooks/useAuth";
import { QRCodeSVG } from "qrcode.react";
import { googleSumExpr } from "@/lib/googleSumExpr";
import { vndFromThousands } from "@/lib/vndThousands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

/** 4×3 pad: top-left is none, remaining 11 slots are the range. */
const RANGE_PAD_SLOTS = 12;
const RANGE_NUMBER_SLOTS = RANGE_PAD_SLOTS - 1;
const RANGE_GAP = RANGE_NUMBER_SLOTS - 1;

function parseQtyBound(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

function clampQtyRange(min: number, max: number, prefer: "min" | "max"): { min: number; max: number } {
  let a = Math.max(1, Math.floor(min));
  let b = Math.max(1, Math.floor(max));
  if (prefer === "min") {
    if (b < a) b = a;
    if (b - a > RANGE_GAP) b = a + RANGE_GAP;
  } else {
    if (a > b) a = b;
    if (b - a > RANGE_GAP) a = Math.max(1, b - RANGE_GAP);
    if (b - a > RANGE_GAP) b = a + RANGE_GAP;
  }
  return { min: a, max: b };
}

function shortVi(d: Date): string {
  return format(d, "d 'th' M");
}

const DEFAULT_TITLE = "Đơn tháng";
const TITLE_STORAGE_KEY = "chiphi:monthly-order-title";
const UNIT_PRICE_NUM_CLASS =
  "font-display text-base font-bold leading-none tabular-nums sm:text-lg";

const COL_OPTIONS: { value: MonthlyOrderCol; label: string }[] = [
  { value: 2, label: "2 cột" },
  { value: 3, label: "3 cột" },
  { value: 4, label: "4 cột" },
  { value: 7, label: "7 cột" },
];

const POPOVER_W = 280;
const POPOVER_H = 340;
const GAP = 10;
const RANGE_KEY_CLASS =
  "rounded-xl border border-[#b8cddc] bg-[#dce8f0] py-2 text-base font-semibold tabular-nums text-[#3a4f58] shadow-sm active:scale-95";
const RANGE_NONE_CLASS =
  "inline-flex items-center justify-center rounded-xl border border-[#e4b8c0] bg-[#ead6d6] text-[#8a4a55] shadow-sm active:scale-95";
const RANGE_GHOST_CLASS =
  "pad-range-ghost relative inline-flex items-center justify-center rounded-xl";
const PAD_KEY_CLASS =
  "keypad-key rounded-xl border border-border/60 bg-card py-2 text-base font-medium shadow-sm active:scale-95";
const PAD_MUTED_CLASS =
  "keypad-key rounded-xl border border-border/60 bg-muted/40 py-2 text-xs font-medium text-muted-foreground active:scale-95";

type AnchorInfo = {
  rect: DOMRect;
  row: number;
  col: number;
  columns: number;
} | null;

export default function MonthlyOrder() {
  const { user } = useAuth();
  const saved = useMemo(() => readMonthlyOrderLocal(), []);
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

  const [startInput, setStartInput] = useState(() => saved?.startInput || toInputValue(defaultStart));
  const [endInput, setEndInput] = useState(() => saved?.endInput || toInputValue(defaultEnd));
  const [columns, setColumns] = useState<MonthlyOrderCol>(() => saved?.columns ?? 4);
  const [totalOpen, setTotalOpen] = useState(false);
  const [boundOpen, setBoundOpen] = useState<"start" | "end" | null>(null);
  const [calMonth, setCalMonth] = useState(() => defaultStart);

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

  const emptyDays = useMemo(() => emptyMonthlyOrderByDate(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const [overrides, setOverrides] = useState<Map<string, MonthlyOrderLine[]>>(
    () => overridesFromCells(saved?.cells),
  );
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [anchor, setAnchor] = useState<AnchorInfo>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; arrow: "top" | "left" | "right"; arrowOffset: number } | null>(null);
  const [rangeMin, setRangeMin] = useState(() => saved?.rangeMin || "16");
  const [rangeMax, setRangeMax] = useState(() => saved?.rangeMax || "26");
  // State for range editor dialog
  const [rangeEditorOpen, setRangeEditorOpen] = useState(false);
  const [rangeEnabled, setRangeEnabled] = useState(() => saved?.rangeEnabled ?? true);
  const [useRangeKeys, setUseRangeKeys] = useState(() => saved?.rangeEnabled ?? true);
  const typingRef = useRef(false);
  const pickTimerRef = useRef<number | null>(null);
  const [pickedRange, setPickedRange] = useState<number | null>(null);
  const [unitPriceDraft, setUnitPriceDraft] = useState(() => saved?.unitPriceDraft || "");
  const [shareToken, setShareToken] = useState<string | null>(() => saved?.shareToken ?? null);
  const [pin, setPin] = useState(DEFAULT_MONTHLY_PIN);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStep, setShareStep] = useState<"pin" | "qr">("pin");
  const [sharing, setSharing] = useState(false);
  const [persistReady, setPersistReady] = useState(false);
  const [title, setTitle] = useState(() => {
    if (saved?.title) return saved.title;
    try {
      return localStorage.getItem(TITLE_STORAGE_KEY) || DEFAULT_TITLE;
    } catch {
      return DEFAULT_TITLE;
    }
  });
  const [editingTitle, setEditingTitle] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingTitle) return;
    const el = titleRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editingTitle]);

  const commitTitle = () => {
    const next = title.trim() || DEFAULT_TITLE;
    setTitle(next);
    setEditingTitle(false);
    try {
      localStorage.setItem(TITLE_STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
  };

  const snapshot = useMemo(
    () => ({
      title,
      startInput,
      endInput,
      columns,
      rangeMin,
      rangeMax,
      rangeEnabled,
      unitPriceDraft,
      cells: cellsFromOverrides(overrides),
      shareToken,
      updatedAt: new Date().toISOString(),
    }),
    [title, startInput, endInput, columns, rangeMin, rangeMax, rangeEnabled, unitPriceDraft, overrides, shareToken],
  );

  useEffect(() => {
    if (!user) {
      setPersistReady(true);
      return;
    }
    let cancelled = false;
    void loadMonthlyOrderRemote(user.id)
      .then(remote => {
        if (cancelled || !remote) return;
        setTitle(remote.title || DEFAULT_TITLE);
        setStartInput(remote.startInput);
        setEndInput(remote.endInput);
        setColumns(remote.columns);
        setRangeMin(remote.rangeMin);
        setRangeMax(remote.rangeMax);
        setRangeEnabled(remote.rangeEnabled);
        setUseRangeKeys(remote.rangeEnabled);
        setUnitPriceDraft(remote.unitPriceDraft);
        setOverrides(overridesFromCells(remote.cells));
        setShareToken(remote.shareToken);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Không tải được đơn tháng";
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setPersistReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!persistReady) return;
    writeMonthlyOrderLocal(snapshot);
    if (!user) return;
    const t = window.setTimeout(() => {
      void saveMonthlyOrderRemote(user.id, snapshot).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Không lưu được đơn tháng";
        toast.error(message);
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [snapshot, user, persistReady]);

  const itemsByDate = useMemo(() => {
    const m = new Map(emptyDays);
    for (const [k, v] of overrides) {
      if (m.has(k)) m.set(k, v);
    }
    return m;
  }, [emptyDays, overrides]);

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
    if (pickTimerRef.current != null) {
      window.clearTimeout(pickTimerRef.current);
      pickTimerRef.current = null;
    }
    setPickedRange(null);
    const lines = itemsByDate.get(info.dateStr) ?? [];
    const current = lines.length > 0 ? lines[0].num : "";
    setEditingDate(info.dateStr);
    setEditingValue(current);
    setAnchor({ rect: info.rect, row: info.row, col: info.col, columns: info.columns });
    typingRef.current = false;
    setUseRangeKeys(rangeEnabled);
  };

  const closeNumpad = () => {
    if (pickTimerRef.current != null) {
      window.clearTimeout(pickTimerRef.current);
      pickTimerRef.current = null;
    }
    setPickedRange(null);
    setEditingDate(null);
    setEditingValue("");
    setAnchor(null);
    setPopoverPos(null);
    typingRef.current = false;
  };

  const rangeBounds = useMemo(() => {
    const min = parseQtyBound(rangeMin);
    const max = parseQtyBound(rangeMax);
    if (min == null || max == null) return null;
    return clampQtyRange(min, max, "min");
  }, [rangeMin, rangeMax]);
  const showRangeKeys = useRangeKeys && rangeBounds != null;
  const rangeCore = useMemo(() => {
    if (!rangeBounds) return [];
    const values: number[] = [];
    for (let n = rangeBounds.min; n <= rangeBounds.max; n++) values.push(n);
    return values;
  }, [rangeBounds]);
  const rangePadKeys = useMemo(() => {
    if (!rangeBounds) return [];
    const values: number[] = [];
    for (let n = rangeBounds.min; n <= rangeBounds.max; n++) values.push(n);
    return values.slice(0, RANGE_NUMBER_SLOTS);
  }, [rangeBounds]);

  const commitQtyRange = (which: "min" | "max") => {
    const min = parseQtyBound(rangeMin);
    const max = parseQtyBound(rangeMax);
    if (min == null || max == null) return;
    const next = clampQtyRange(min, max, which);
    setRangeMin(String(next.min));
    setRangeMax(String(next.max));
  };

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
    const replace = !typingRef.current;
    typingRef.current = true;
    setEditingValue(prev => {
      if (replace) return d;
      if (prev.length >= 4) return prev;
      if (prev === "0") return d;
      return prev + d;
    });
  };

  const handleBackspace = () => {
    setEditingValue(prev => {
      const next = prev.slice(0, -1);
      if (next === "") typingRef.current = false;
      return next;
    });
  };
  const handleClear = () => {
    setEditingValue("");
    typingRef.current = false;
  };
  const handleSave = (value?: string) => {
    if (!editingDate) return;
    const raw = typeof value === "string" ? value : editingValue;
    const v = raw.trim();
    const next: MonthlyOrderLine[] = v === "" ? [] : [{ num: v.replace(/^0+(?=\d)/, "") || "0" }];
    setOverrides(prev => {
      const m = new Map(prev);
      m.set(editingDate, next);
      return m;
    });
    closeNumpad();
  };
  const pickRange = (n: number) => {
    if (!editingDate) return;
    if (pickTimerRef.current != null) window.clearTimeout(pickTimerRef.current);
    setEditingValue(String(n));
    setPickedRange(n);
    pickTimerRef.current = window.setTimeout(() => {
      pickTimerRef.current = null;
      handleSave(String(n));
    }, 520);
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

  const confirmPinAndShare = async () => {
    const trimmed = (pin || DEFAULT_MONTHLY_PIN).trim();
    if (!trimmed) {
      toast.error("Nhập PIN");
      return;
    }
    setSharing(true);
    try {
      const token = shareToken || generateShareToken();
      const pinHash = await hashPin(trimmed);
      if (user) {
        await saveMonthlyOrderRemote(user.id, { ...snapshot, shareToken: token }, { shareToken: token, pinHash });
      }
      setShareToken(token);
      writeMonthlyOrderLocal({ ...snapshot, shareToken: token });
      setShareStep("qr");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Không tạo được link chia sẻ";
      toast.error(message);
    } finally {
      setSharing(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareToken) return;
    try {
      await navigator.clipboard.writeText(monthlyShareUrl(shareToken));
      toast.success("Đã sao chép link");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Không copy được");
    }
  };

  useEffect(() => {
    if (!editingDate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNumpad();
      if (e.key === "Enter") handleSave();
      if (e.key === "Backspace") {
        e.preventDefault();
        if (!showRangeKeys) handleBackspace();
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        if (showRangeKeys && e.key !== "0") {
          const rv = rangeCore[Number(e.key) - 1];
          if (rv != null) pickRange(rv);
          return;
        }
        if (!showRangeKeys) handleDigit(e.key);
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    // Don't lock body for inline popover — keep grid scrollable but backdrop handles close
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [editingDate, editingValue, showRangeKeys, rangeCore]);

  const hasInvalidRange = !parsed;

  const openBound = (which: "start" | "end") => {
    setCalMonth(which === "start" ? rangeStart : rangeEnd);
    setBoundOpen(which);
  };

  const pickBound = (which: "start" | "end", day: Date) => {
    const value = toInputValue(day);
    if (which === "start") setStartInput(value);
    else setEndInput(value);
    setBoundOpen(null);
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
            {editingTitle ? (
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                <input
                  ref={titleRef}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitTitle();
                    }
                    if (e.key === "Escape") {
                      try {
                        setTitle(localStorage.getItem(TITLE_STORAGE_KEY) || DEFAULT_TITLE);
                      } catch {
                        setTitle(DEFAULT_TITLE);
                      }
                      setEditingTitle(false);
                    }
                  }}
                  className="min-w-0 flex-1 bg-transparent font-display text-[17px] leading-tight text-foreground outline-none caret-primary sm:text-xl"
                  aria-label="Tên đơn"
                  autoComplete="off"
                  enterKeyHint="done"
                />
                <ClearFieldButton
                  visible={title.length > 0}
                  size="sm"
                  label="Xóa tên"
                  onClear={() => setTitle("")}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="flex min-w-0 max-w-full items-center gap-2 rounded-md text-left hover:bg-muted/40"
                aria-label="Đổi tên đơn"
              >
                <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                <h1 className="min-w-0 truncate font-display text-[17px] leading-tight text-foreground sm:text-xl">
                  {title}
                </h1>
              </button>
            )}
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {hasInvalidRange ? "Chọn ngày bắt đầu và kết thúc" : `${shortVi(rangeStart)} – ${shortVi(rangeEnd)} · ${dayCount} ngày`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShareStep(shareToken ? "qr" : "pin");
              setShareOpen(true);
            }}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Chia sẻ đơn tháng"
          >
            <Share2 className="h-4 w-4" />
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
              <Popover
                open={boundOpen === "start"}
                onOpenChange={open => (open ? openBound("start") : setBoundOpen(null))}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-left shadow-sm transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    aria-label="Chọn ngày bắt đầu"
                  >
                    <span className="min-w-0 truncate text-sm font-semibold tabular-nums">
                      {hasInvalidRange ? "—" : shortVi(rangeStart)}
                    </span>
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={8}
                  className="w-auto rounded-2xl border-border/60 bg-popover p-0 shadow-warm-lg"
                >
                  <MonthBoundCalendar
                    month={calMonth}
                    onMonthChange={setCalMonth}
                    selected={rangeStart}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onSelect={day => pickBound("start", day)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="min-w-0 space-y-1">
              <span className="block pl-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Đến ngày
              </span>
              <Popover
                open={boundOpen === "end"}
                onOpenChange={open => (open ? openBound("end") : setBoundOpen(null))}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-left shadow-sm transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    aria-label="Chọn ngày kết thúc"
                  >
                    <span className="min-w-0 truncate text-sm font-semibold tabular-nums">
                      {hasInvalidRange ? "—" : shortVi(rangeEnd)}
                    </span>
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="w-auto rounded-2xl border-border/60 bg-popover p-0 shadow-warm-lg"
                >
                  <MonthBoundCalendar
                    month={calMonth}
                    onMonthChange={setCalMonth}
                    selected={rangeEnd}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onSelect={day => pickBound("end", day)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {hasInvalidRange && (
            <p className="text-[11px] text-destructive">Ngày không hợp lệ — kiểm tra định dạng YYYY-MM-DD</p>
          )}
          {dayCount > 60 && (
            <p className="text-[11px] text-amber-600">Khoảng tối đa 60 ngày — đã tự cắt cho dễ xem.</p>
          )}
        </div>
      </div>

      {/* Table controls: column and range customizers */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-background border-b border-border/50">
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
          aria-pressed={rangeEnabled}
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1.5 text-[11px] font-medium leading-none transition-colors ${
            rangeEnabled
              ? "border-[#b8cddc] bg-[#dce8f0] text-[#3a4f58] shadow-sm"
              : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          }`}
          aria-label="Chỉnh dãy số"
        >
          <LayoutGrid className="h-3 w-3 opacity-70" />
          {rangeBounds ? `${rangeBounds.min}–${rangeBounds.max}` : `${rangeMin}–${rangeMax}`}
        </button>
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
        {/* Bottom total bar — result cluster centered */}
        <div className="relative flex min-h-12 shrink-0 items-center border-t border-border bg-card px-3 py-2 sm:px-4">
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tổng</span>
          <div className="pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              disabled={hasInvalidRange}
              onClick={() => setTotalOpen(true)}
              className="total-amount-hit pointer-events-auto shrink-0 hover:bg-muted/50 disabled:pointer-events-none"
              aria-label="Xem chi tiết tổng"
            >
              <span className={`leading-none ${UNIT_PRICE_NUM_CLASS}`}>
                {hasInvalidRange ? "—" : stats.totalSum}
              </span>
            </button>
            <span className="shrink-0 text-muted-foreground/45" aria-hidden>
              ×
            </span>
            <label className="monthly-unit-price pointer-events-auto inline-flex shrink-0 items-baseline rounded-md border border-border/70 bg-background px-1.5 py-0.5">
              <span className="relative inline-grid min-w-[1ch]">
                <span
                  className={`invisible col-start-1 row-start-1 whitespace-pre ${UNIT_PRICE_NUM_CLASS}`}
                  aria-hidden
                >
                  {unitPriceDraft || "giá"}
                </span>
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  size={1}
                  value={unitPriceDraft}
                  placeholder="giá"
                  aria-label="Đơn giá (nghìn đồng)"
                  disabled={hasInvalidRange}
                  onChange={e => setUnitPriceDraft(e.target.value.replace(/[^\d.]/g, ""))}
                  className={`col-start-1 row-start-1 w-full min-w-0 border-0 bg-transparent p-0 text-center shadow-none outline-none placeholder:font-medium placeholder:text-muted-foreground/40 focus-visible:ring-0 ${UNIT_PRICE_NUM_CLASS}`}
                />
              </span>
              {unitPriceDraft ? (
                <ThousandsMark className="text-[0.7em] font-display font-bold leading-none text-muted-foreground/70" />
              ) : null}
            </label>
            {unitPriceVnd > 0 && !hasInvalidRange ? (
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
          </div>
          {unitPriceVnd > 0 && !hasInvalidRange ? null : (
            <span className="ml-auto shrink-0 text-right text-[10px] tabular-nums text-muted-foreground sm:text-[11px]">
              {hasInvalidRange ? "" : `${stats.daysWithItems}/${dayCount} ngày`}
            </span>
          )}
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

            <div className={`relative mx-3 flex h-12 items-center justify-center overflow-hidden rounded-xl border bg-muted/30 px-3 pr-11 text-xl font-bold tabular-nums${pickedRange != null ? " pad-value-preview" : ""}`}>
              {editingValue !== "" ? (
                editingValue
              ) : (
                <span className="text-sm font-medium text-muted-foreground/40">— trống —</span>
              )}
              {rangeBounds != null ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={useRangeKeys}
                  className="pad-mode-flip"
                  onClick={() => {
                    setUseRangeKeys(on => {
                      const next = !on;
                      if (next) typingRef.current = false;
                      return next;
                    });
                  }}
                  aria-label={useRangeKeys ? "Dùng dãy số" : "Bàn phím 0–9"}
                >
                  <span className="pad-mode-flip__well">
                    <span className="pad-mode-flip__pebble" />
                    <span className="pad-mode-flip__mark pad-mode-flip__mark--range">
                      <GripHorizontal className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </span>
                    <span className="pad-mode-flip__mark pad-mode-flip__mark--keys">
                      <Hash className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </span>
                  </span>
                </button>
              ) : null}
            </div>

            {showRangeKeys ? (
              <div className="grid grid-cols-4 gap-1.5 p-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  className={RANGE_NONE_CLASS}
                  style={{ minHeight: "2.5rem" }}
                  aria-label="Xóa số ngày này"
                >
                  <X className="h-4 w-4" strokeWidth={2.6} />
                </button>
                {rangePadKeys.map(value => (
                  <button
                    key={`pad-${value}`}
                    type="button"
                    onClick={() => pickRange(value)}
                    className={`${RANGE_KEY_CLASS}${pickedRange === value ? " pad-range-key--picked" : ""}`}
                    style={{ minHeight: "2.5rem" }}
                  >
                    {value}
                  </button>
                ))}
                {Array.from({ length: Math.max(0, RANGE_NUMBER_SLOTS - rangePadKeys.length) }).map((_, i) => (
                  <span
                    key={`pad-empty-${i}`}
                    className={RANGE_GHOST_CLASS}
                    style={{ minHeight: "2.5rem", opacity: 0.2 }}
                    aria-hidden
                  />
                ))}
              </div>
            ) : (
              <>
            <div className="grid grid-cols-3 gap-1.5 p-3 pb-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDigit(d)}
                  className={PAD_KEY_CLASS}
                  style={{ minHeight: "2.5rem" }}
                >
                  {d}
                </button>
              ))}
                <button
                  type="button"
                  onClick={handleClear}
                  className={PAD_MUTED_CLASS}
                  style={{ minHeight: "2.5rem" }}
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit("0")}
                  className={PAD_KEY_CLASS}
                  style={{ minHeight: "2.5rem" }}
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className={PAD_MUTED_CLASS}
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
                  onClick={() => handleSave()}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Check className="h-3.5 w-3.5" />
                  Lưu
                </button>
            </div>
              </>
            )}
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
      <Dialog
        open={shareOpen}
        onOpenChange={open => {
          setShareOpen(open);
          if (!open) setShareStep(shareToken ? "qr" : "pin");
        }}
      >
        <DialogContent className="max-w-[92vw] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">
              {shareStep === "pin" ? "Đặt PIN chia sẻ" : "Gửi đơn tháng"}
            </DialogTitle>
          </DialogHeader>
          {shareStep === "pin" ? (
            <div className="space-y-4 py-1">
              <p className="text-xs text-muted-foreground">
                Người nhận cần PIN này để mở lưới. Mặc định {DEFAULT_MONTHLY_PIN}.
              </p>
              <Input
                type="text"
                inputMode="numeric"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder={DEFAULT_MONTHLY_PIN}
                className="h-11 text-center text-lg tracking-[0.35em]"
                maxLength={8}
                autoFocus
              />
              <Button type="button" className="w-full" disabled={sharing} onClick={() => void confirmPinAndShare()}>
                {sharing ? "Đang tạo…" : "Tạo link & QR"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-2">
              {shareToken && (
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <QRCodeSVG value={monthlyShareUrl(shareToken)} size={180} level="M" />
                </div>
              )}
              <p className="w-full break-all rounded-lg bg-muted/50 px-3 py-2 text-center text-[11px] text-muted-foreground">
                {shareToken ? monthlyShareUrl(shareToken) : ""}
              </p>
              <p className="text-center text-xs text-muted-foreground">
                PIN: <span className="font-semibold text-foreground">{pin || DEFAULT_MONTHLY_PIN}</span>
              </p>
              <Button type="button" onClick={() => void copyShareLink()} className="w-full gap-2">
                <Copy className="h-4 w-4" />
                Copy link
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => setShareStep("pin")}>
                Đổi PIN
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rangeEditorOpen} onOpenChange={setRangeEditorOpen}>
        <DialogContent className="max-w-[90vw] rounded-xl sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">Dãy số</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
              <span className="text-sm font-medium">Dãy nhanh</span>
              <Switch
                checked={rangeEnabled}
                onCheckedChange={checked => {
                  setRangeEnabled(checked);
                  setUseRangeKeys(checked);
                }}
                aria-label="Bật dãy số trên bàn phím"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1">Từ</label>
                <Input
                  type="number"
                  value={rangeMin}
                  onChange={e => setRangeMin(e.target.value)}
                  onBlur={() => commitQtyRange("min")}
                  placeholder="16"
                  className="h-9 text-sm"
                  inputMode="numeric"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Đến</label>
                <Input
                  type="number"
                  value={rangeMax}
                  onChange={e => setRangeMax(e.target.value)}
                  onBlur={() => commitQtyRange("max")}
                  placeholder="28"
                  className="h-9 text-sm"
                  inputMode="numeric"
                  min={2}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tối đa {RANGE_NUMBER_SLOTS} số trên bàn phím. Ô góc trái là X — xóa số ngày đó.
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRangeEditorOpen(false)} className="flex-1">
              Hủy
            </Button>
            <Button size="sm" onClick={() => { commitQtyRange("min"); setRangeEditorOpen(false); }} className="flex-1">
              Lưu
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
