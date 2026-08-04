import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import PaymentGroup, { type PaymentGroupData, type PaymentEntry } from "./PaymentGroup";
import AmountPhase from "./AmountPhase";
import PurchaseDetailDialog from "./PurchaseDetailDialog";
import RangeDayPicker from "./RangeDayPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { VerifyData } from "@/types/expense";

type ViewMode = "range" | "daily";

/** First accounting period: Aug 5 – Sep 3 (30 days). Later periods shift by 30 days. */
const PERIOD_ANCHOR = new Date(2026, 7, 5); // Aug 5, 2026 local
const PERIOD_LENGTH_DAYS = 30;

function getPeriodBounds(offset: number) {
  const start = addDays(PERIOD_ANCHOR, offset * PERIOD_LENGTH_DAYS);
  const end = addDays(start, PERIOD_LENGTH_DAYS - 1);
  return { start, end };
}

function getPeriodOffsetForDate(date: Date) {
  return Math.floor(differenceInCalendarDays(date, PERIOD_ANCHOR) / PERIOD_LENGTH_DAYS);
}

interface DbItem {
  id: string;
  name: string;
  category_id: string | null;
  sub_category_id: string | null;
  sub_sub_category_id: string | null;
  default_supplier_id: string | null;
  default_unit_price: number | null;
  unit: string | null;
}

interface MatchInfo {
  itemId: string;
  categoryName: string;
  subCategoryName: string;
  supplierName: string;
  unitPrice: number;
  unit: string;
  categoryId: string | null;
  subCategoryId: string | null;
  subSubCategoryId: string | null;
  supplierId: string | null;
}

type InputPhase = "name" | "amount" | "done";
type CategoryFrequency = "daily" | "weekly" | "monthly";

interface QuickCategory {
  id: string;
  name: string;
  frequency: CategoryFrequency;
}

export default function DailyExpenseTable() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("range");
  const [periodOffset, setPeriodOffset] = useState(() => getPeriodOffsetForDate(new Date()));
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const period = useMemo(() => getPeriodBounds(periodOffset), [periodOffset]);
  const periodStartStr = format(period.start, "yyyy-MM-dd");
  const periodEndStr = format(period.end, "yyyy-MM-dd");
  const expenseDate = viewMode === "daily" ? selectedDate : format(new Date(), "yyyy-MM-dd");

  // Reference data
  const [items, setItems] = useState<DbItem[]>([]);
  const [categories, setCategories] = useState<QuickCategory[]>([]);
  const [subCategories, setSubCategories] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [itemFrequency, setItemFrequency] = useState<Record<string, number>>({});

  // Day data - grouped by payment
  const [paymentGroups, setPaymentGroups] = useState<PaymentGroupData[]>([]);
  const [dayTotal, setDayTotal] = useState(0);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);

  // Input state
  const [phase, setPhase] = useState<InputPhase>("name");
  const [nameValue, setNameValue] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [verifyData, setVerifyData] = useState<VerifyData | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // UI state
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(true);
  const [cardClosing, setCardClosing] = useState(false);
  const [detailEntry, setDetailEntry] = useState<PaymentEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef(0);

  const HIGH_VALUE_THRESHOLD = 200000;
  const QUICK_CATEGORY_DETAILS: { name: string; emoji: string; gradient: string }[] = [
    { name: "Điện", emoji: "⚡", gradient: "linear-gradient(135deg, #c9ad86, #b99578)" },
    { name: "Thuê nhà", emoji: "🏠", gradient: "linear-gradient(135deg, #b99a9b, #a98289)" },
    { name: "Gas", emoji: "🔥", gradient: "linear-gradient(135deg, #c69a83, #b77f72)" },
    { name: "Đi chợ", emoji: "🛒", gradient: "linear-gradient(135deg, #9caf9b, #849f91)" },
    { name: "Bánh mì", emoji: "🥖", gradient: "linear-gradient(135deg, #c8b487, #b49a73)" },
    { name: "Nguyên vật liệu", emoji: "🥬", gradient: "linear-gradient(135deg, #a7b298, #879d88)" },
    { name: "Nước dừa", emoji: "🥥", gradient: "linear-gradient(135deg, #9db5b4, #829fa3)" },
    { name: "Muối", emoji: "🧂", gradient: "linear-gradient(135deg, #a8afb2, #8e989f)" },
    { name: "Shopee", emoji: "🛍️", gradient: "linear-gradient(135deg, #c39b8d, #b27d79)" },
    { name: "Internet", emoji: "🌐", gradient: "linear-gradient(135deg, #9caabd, #818fa9)" },
    { name: "Sửa chữa", emoji: "🛠️", gradient: "linear-gradient(135deg, #b29e8e, #9a8179)" },
    { name: "Vệ sinh", emoji: "🧼", gradient: "linear-gradient(135deg, #9db7b5, #7f9e9f)" },
    { name: "Lương NV", emoji: "👥", gradient: "linear-gradient(135deg, #aa9cad, #907e9e)" },
    { name: "Thuế", emoji: "🧾", gradient: "linear-gradient(135deg, #a3aab7, #858e9f)" },
    { name: "BHXH", emoji: "🛡️", gradient: "linear-gradient(135deg, #91ada3, #76988d)" },
    { name: "Rác", emoji: "♻️", gradient: "linear-gradient(135deg, #a5ae8d, #8f9d78)" },
    { name: "Giữ xe", emoji: "🅿️", gradient: "linear-gradient(135deg, #a5a3a0, #898987)" },
    { name: "Khác", emoji: "✦", gradient: "linear-gradient(135deg, #b29aab, #9f7f94)" },
  ];
  const frequencyOrder: Record<CategoryFrequency, number> = { daily: 0, weekly: 1, monthly: 2 };
  const quickCategories = QUICK_CATEGORY_DETAILS
    .map(detail => ({ ...detail, category: categories.find(category => category.name.toLowerCase() === detail.name.toLowerCase()) }))
    .sort((a, b) => frequencyOrder[a.category?.frequency || "daily"] - frequencyOrder[b.category?.frequency || "daily"]);

  // Load reference data once
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [itemsRes, catsRes, subsRes, supsRes, freqRes] = await Promise.all([
        supabase.from("items").select("*").eq("user_id", user.id),
        supabase.from("categories").select("id, name, frequency").eq("user_id", user.id),
        supabase.from("sub_categories").select("id, name").eq("user_id", user.id),
        supabase.from("suppliers").select("id, name").eq("user_id", user.id),
        supabase.from("sub_payments").select("item_id").eq("user_id", user.id).not("item_id", "is", null),
      ]);
      if (itemsRes.data) setItems(itemsRes.data);
      if (catsRes.data) {
        setCategories(catsRes.data.map(category => ({
          ...category,
          frequency: (category.frequency as CategoryFrequency) || "daily",
        })));
      }
      if (subsRes.data) setSubCategories(subsRes.data);
      if (supsRes.data) setSuppliers(supsRes.data);
      if (freqRes.data) {
        const freq: Record<string, number> = {};
        freqRes.data.forEach((r: { item_id: string | null }) => {
          if (r.item_id) freq[r.item_id] = (freq[r.item_id] || 0) + 1;
        });
        setItemFrequency(freq);
      }
    };
    load();
  }, [user]);

  // Load data for selected date or range - grouped by payment
  useEffect(() => {
    if (!user) return;
    setPaymentGroups([]);
    setDayTotal(0);
    setActivePaymentId(null);

    const loadPayments = async () => {
      let query = supabase
        .from("payments")
        .select("id, date, total_amount, supplier_id, sub_payments(id, item_name, amount, category_id, supplier_id)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (viewMode === "daily") {
        query = query.eq("date", selectedDate);
      } else {
        query = query.gte("date", periodStartStr).lte("date", periodEndStr);
      }

      const { data: payments } = await query;

      if (payments && payments.length > 0) {
        let total = 0;
        const groups: PaymentGroupData[] = payments.map((p: any) => {
          const subs = (p.sub_payments as any[]) || [];
          const paymentTotal = subs.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
          total += paymentTotal;

          // Determine supplier name from payment-level or first sub_payment
          const supplierId = p.supplier_id || (subs.length > 0 ? subs[0].supplier_id : null);
          const supplierName = supplierId
            ? suppliers.find(s => s.id === supplierId)?.name || null
            : null;

          return {
            paymentId: p.id,
            supplierName,
            total: paymentTotal,
            date: viewMode === "range" ? p.date : undefined,
            entries: subs.map((s: any) => ({
              item_name: s.item_name,
              amount: Number(s.amount),
              category_id: s.category_id,
              supplier_id: s.supplier_id,
              sub_payment_id: s.id,
            })),
          };
        });

        // In range mode, newest dates first for easier scanning
        if (viewMode === "range") {
          groups.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        }

        setPaymentGroups(groups);
        setDayTotal(total);
        if (viewMode === "range") {
          const todayStr = format(new Date(), "yyyy-MM-dd");
          const todayPayments = payments.filter((p: any) => p.date === todayStr);
          setActivePaymentId(
            todayPayments.length > 0 ? todayPayments[todayPayments.length - 1].id : null
          );
        } else {
          setActivePaymentId(payments[payments.length - 1].id);
        }
      }
    };
    loadPayments();
  }, [user, selectedDate, suppliers, viewMode, periodStartStr, periodEndStr]);

  useEffect(() => {
    if (phase === "name" && cardExpanded) nameRef.current?.focus();
  }, [phase, cardExpanded]);

  // Click outside card to collapse
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!cardExpanded || cardClosing) return;
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setCardClosing(true);
        setTimeout(() => {
          setCardExpanded(false);
          setCardClosing(false);
        }, 320);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [cardExpanded, cardClosing]);

  const findItem = useCallback((name: string): DbItem | undefined => {
    const lower = name.toLowerCase().trim();
    return items.find(i => i.name.toLowerCase() === lower) ||
      items.find(i => i.name.toLowerCase().includes(lower));
  }, [items]);

  const getCategoryName = useCallback((catId: string | null) => {
    if (!catId) return undefined;
    return categories.find(c => c.id === catId)?.name;
  }, [categories]);

  const getSupplierName = useCallback((supId: string | null) => {
    if (!supId) return undefined;
    return suppliers.find(s => s.id === supId)?.name;
  }, [suppliers]);

  const handleQuickCategory = useCallback(async (categoryName: string) => {
    if (!user) return;
    const existing = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    let categoryId = existing?.id || null;

    if (!categoryId) {
      const { data, error } = await supabase
        .from("categories")
        .insert({ name: categoryName, user_id: user.id })
        .select("id, name")
        .single();
      if (error) {
        toast.error(error.message || "Không thể chọn danh mục");
        return;
      }
      if (data) {
        setCategories(prev => [...prev, { ...data, frequency: "daily" }]);
        categoryId = data.id;
      }
    }

    setSelectedCategoryId(categoryId);
    setNameValue(categoryName);
    setMatch({
      itemId: "",
      categoryName,
      subCategoryName: "",
      supplierName: "",
      unitPrice: 0,
      unit: "unit",
      categoryId,
      subCategoryId: null,
      subSubCategoryId: null,
      supplierId: null,
    });
    setVerifyData({
      itemName: categoryName,
      categoryName,
      subCategoryName: "",
      supplierName: "",
      unitPrice: 0,
      unit: "unit",
      categoryId: categoryId ?? undefined,
    });
    setPhase("amount");
    setTimeout(() => amountRef.current?.focus(), 50);
  }, [user, categories]);

  const handleNameConfirm = useCallback(() => {
    if (!nameValue.trim()) return;
    const matched = findItem(nameValue);
    if (matched) {
      const cat = categories.find(c => c.id === matched.category_id);
      const sub = subCategories.find(s => s.id === matched.sub_category_id);
      const sup = suppliers.find(s => s.id === matched.default_supplier_id);
      const matchInfo: MatchInfo = {
        itemId: matched.id,
        categoryName: cat?.name ?? "",
        subCategoryName: sub?.name ?? "",
        supplierName: sup?.name ?? "",
        unitPrice: matched.default_unit_price ?? 0,
        unit: matched.unit ?? "unit",
        categoryId: matched.category_id,
        subCategoryId: matched.sub_category_id,
        subSubCategoryId: matched.sub_sub_category_id,
        supplierId: matched.default_supplier_id,
      };
      setMatch(matchInfo);

      // Show verify popup
      setVerifyData({
        itemName: nameValue.trim(),
        categoryName: cat?.name ?? "",
        subCategoryName: sub?.name ?? "",
        supplierName: sup?.name ?? "",
        unitPrice: matched.default_unit_price ?? 0,
        unit: matched.unit ?? "unit",
        itemId: matched.id,
        categoryId: matched.category_id ?? undefined,
        subCategoryId: matched.sub_category_id ?? undefined,
        supplierId: matched.default_supplier_id ?? undefined,
      });
      setPhase("amount");
      setTimeout(() => amountRef.current?.focus(), 50);
    } else {
      setMatch(null);
      setVerifyData(null);
      setPhase("amount");
      setTimeout(() => amountRef.current?.focus(), 50);
    }
  }, [nameValue, findItem, categories, subCategories, suppliers]);



  const handleSave = useCallback(async () => {
    if (!amountValue.trim() || !user) return;
    // User types in thousands — multiply by 1000 to get real VND amount
    const amount = (Number(amountValue) || 0) * 1000;
    if (amount === 0) return;

    let pid = activePaymentId;
    if (!pid) {
      const { data: newPayment } = await supabase
        .from("payments")
        .insert({ date: expenseDate, user_id: user.id, total_amount: 0, supplier_id: match?.supplierId || null })
        .select("id")
        .single();
      if (newPayment) {
        pid = newPayment.id;
        setActivePaymentId(pid);
      }
    }
    if (!pid) return;

    const { error } = await supabase.from("sub_payments").insert({
      payment_id: pid,
      item_name: nameValue.trim(),
      item_id: match?.itemId || null,
      quantity: match?.unitPrice ? amount / match.unitPrice : 1,
      unit_price: match?.unitPrice || amount,
      amount,
      category_id: match?.categoryId || null,
      sub_category_id: match?.subCategoryId || null,
      sub_sub_category_id: match?.subSubCategoryId || null,
      supplier_id: match?.supplierId || null,
      user_id: user.id,
    });

    if (error) {
      toast.error("Lưu thất bại");
      return;
    }

    const newEntry: PaymentEntry = {
      item_name: nameValue.trim(),
      amount,
      category_id: match?.categoryId || null,
      supplier_id: match?.supplierId || null,
      sub_payment_id: undefined,
    };

    // Update or create group
    setPaymentGroups(prev => {
      const existing = prev.find(g => g.paymentId === pid);
      if (existing) {
        return prev.map(g => g.paymentId === pid ? {
          ...g,
          entries: [...g.entries, newEntry],
          total: g.total + amount,
          supplierName: g.supplierName || (match?.supplierName || null),
        } : g);
      } else {
        return [...prev, {
          paymentId: pid!,
          supplierName: match?.supplierName || null,
          total: amount,
          date: viewMode === "range" ? expenseDate : undefined,
          entries: [newEntry],
        }];
      }
    });
    setDayTotal(prev => prev + amount);

    setPhase("done");
    setJustSaved(true);
    setTimeout(() => {
      setNameValue("");
      setAmountValue("");
      setSelectedCategoryId(null);
      setMatch(null);
      setVerifyData(null);
      setJustSaved(false);
      setPhase("name");
    }, 600);
  }, [amountValue, nameValue, match, activePaymentId, user, expenseDate, viewMode]);

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      handleNameConfirm();
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Backspace" && amountValue === "") {
      e.preventDefault();
      setPhase("name");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  };

  const handleRangeDaySelect = (date: Date) => {
    setSelectedDate(format(date, "yyyy-MM-dd"));
    setViewMode("daily");
    setRangePickerOpen(false);
  };

  const handleViewFullRange = () => {
    setViewMode("range");
    setRangePickerOpen(false);
  };

  const shiftPeriod = (delta: number) => {
    setPeriodOffset(prev => prev + delta);
    setViewMode("range");
    setRangePickerOpen(false);
  };

  const expandCard = useCallback(() => {
    setCardExpanded(true);
    setTimeout(() => nameRef.current?.focus(), 100);
  }, []);

  const handleMainDoubleActivate = useCallback((target: EventTarget | null) => {
    if (cardExpanded || cardClosing) return;
    const el = target as HTMLElement | null;
    if (el?.closest("button, a, input, textarea, [role='button'], [data-no-double-tap]")) return;
    expandCard();
  }, [cardExpanded, cardClosing, expandCard]);

  const handleMainClick = useCallback((e: React.MouseEvent) => {
    // Desktop double-click
    if (e.detail === 2) {
      handleMainDoubleActivate(e.target);
      return;
    }
    // Mobile / touch fallback: two taps within 320ms
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      handleMainDoubleActivate(e.target);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [handleMainDoubleActivate]);

  const startNewPurchase = () => {
    setActivePaymentId(null);
    setNameValue("");
    setAmountValue("");
    setSelectedCategoryId(null);
    setMatch(null);
    setVerifyData(null);
    setPhase("name");
    setCardExpanded(true);
    setTimeout(() => nameRef.current?.focus(), 100);
  };

  // Swipe between days (daily, within period) or periods (range)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.7) return;

    if (viewMode === "range") {
      setPeriodOffset(prev => prev + (dx > 0 ? -1 : 1));
      return;
    }

    const current = new Date(selectedDate + "T00:00:00");
    const next = addDays(current, dx > 0 ? -1 : 1);
    if (next < period.start || next > period.end) return;
    setSelectedDate(format(next, "yyyy-MM-dd"));
  }, [selectedDate, viewMode, period.start, period.end]);

  const centerLabel = viewMode === "range"
    ? `${format(period.start, "MMM d")} – ${format(period.end, "MMM d")}`
    : format(new Date(selectedDate + "T00:00:00"), "EEE, MMM d");

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleMainClick}
    >
      {/* Top bar: brand | centered range switcher | total */}
      <div className="px-4 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2" data-no-double-tap>
        <span className="font-display text-xl text-primary justify-self-start">Mìsè</span>

        <Popover open={rangePickerOpen} onOpenChange={setRangePickerOpen}>
          <div className="flex items-center gap-0.5 justify-self-center">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="p-1 text-muted-foreground hover:text-foreground rounded-md"
              aria-label="Previous period"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="px-2.5 py-1 rounded-full border border-border/60 bg-muted/40 hover:bg-muted transition-colors text-center min-w-[8.5rem]"
                aria-label="Open day picker for this period"
              >
                <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {viewMode === "range" ? "Theo kỳ" : "Theo ngày"}
                </span>
                <span className="block text-xs font-display tabular-nums leading-tight">
                  {centerLabel}
                </span>
              </button>
            </PopoverTrigger>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="p-1 text-muted-foreground hover:text-foreground rounded-md"
              aria-label="Next period"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <PopoverContent className="w-auto p-3 border-border/60" align="center">
            <RangeDayPicker
              rangeStart={period.start}
              rangeEnd={period.end}
              selected={
                viewMode === "daily"
                  ? new Date(selectedDate + "T00:00:00")
                  : undefined
              }
              onSelect={handleRangeDaySelect}
              onViewRange={handleViewFullRange}
            />
          </PopoverContent>
        </Popover>

        <div className="justify-self-end text-right">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground block">Tổng</span>
          <span className="text-lg font-display block leading-tight">{dayTotal.toLocaleString("vi-VN")} ₫</span>
        </div>
      </div>

      {/* Grouped entries */}
      <div className={`flex-1 overflow-auto px-4 ${cardExpanded ? "pb-[50vh]" : "pb-24"}`}>
        {paymentGroups.length === 0 && (
          <div className="text-center pt-12 text-muted-foreground text-sm">
            <p>Chưa có chi tiêu nào</p>
            {!cardExpanded && (
              <p className="text-[11px] mt-2 text-muted-foreground/70">Chạm đúp để thêm chi tiêu</p>
            )}
          </div>
        )}
        {paymentGroups.map((group) => (
          <PaymentGroup
            key={group.paymentId}
            group={group}
            getCategoryName={getCategoryName}
            getSupplierName={getSupplierName}
            highValueThreshold={HIGH_VALUE_THRESHOLD}
            onEntryClick={(entry) => { setDetailEntry(entry); setDetailOpen(true); }}
            onEntryDelete={async (paymentId, entry, index) => {
              if (entry.sub_payment_id) {
                await supabase.from("sub_payments").delete().eq("id", entry.sub_payment_id);
              }
              setPaymentGroups(prev => prev.map(g => {
                if (g.paymentId !== paymentId) return g;
                const newEntries = g.entries.filter((_, i) => i !== index);
                return { ...g, entries: newEntries, total: newEntries.reduce((s, e) => s + e.amount, 0) };
              }).filter(g => g.entries.length > 0));
              setDayTotal(prev => prev - entry.amount);
              toast.success("Deleted");
            }}
          />
        ))}

        {/* New purchase button */}
        {paymentGroups.length > 0 && (
          <button
            onClick={startNewPurchase}
            className="w-full mt-2 py-2.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg hover:border-primary/40 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Lần mua mới
          </button>
        )}
      </div>

      {/* FAB when collapsed */}
      {!cardExpanded && (
        <button
          onClick={expandCard}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-transform animate-in fade-in zoom-in-90 duration-200"
          aria-label="Add expense"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Floating input card */}
      {cardExpanded && (
        <div
          ref={cardRef}
          className={`fixed bottom-0 left-0 right-0 z-50 ${cardClosing ? "expense-card-exit" : "expense-card-enter"}`}
          style={{ height: "45vh" }}
          data-no-double-tap
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="absolute -top-8 left-0 right-0 h-8 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
          />

          <div
            className={`h-full rounded-t-2xl border-t border-border/60 flex flex-col transition-colors duration-400 overflow-hidden ${
              justSaved ? "bg-secondary/30" : "bg-card"
            }`}
            style={{ boxShadow: "0 -8px 40px -4px hsl(25 30% 20% / 0.10)" }}
          >
            {/* Phase indicator */}
            <div className="flex items-center gap-2 px-5 pt-4 pb-1">
              <div className={`h-1.5 flex-1 rounded-full transition-colors duration-400 ${
                phase === "name" ? "bg-primary" : "bg-primary/30"
              }`} />
              <div className={`h-1.5 flex-1 rounded-full transition-colors duration-400 ${
                phase === "amount" || phase === "done" ? "bg-primary" : "bg-muted"
              }`} />
            </div>

            {/* Success flash */}
            {justSaved && (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-400">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <Check className="h-6 w-6 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-display">{nameValue}</p>
                    <p className="text-2xl font-display">{(Number(amountValue) * 1000).toLocaleString("vi-VN")} ₫</p>
                  </div>
                </div>
              </div>
            )}

            {/* Name phase */}
            {phase === "name" && !justSaved && (
              <div className="flex-1 flex min-h-0 flex-col px-5 pt-2 pb-3">
                <div className="category-rail -mx-5 min-h-0 flex-1 overflow-x-auto px-5 pb-3" role="list" aria-label="Danh mục nhanh">
                  <div className="grid h-full w-max grid-flow-row grid-cols-3 auto-rows-fr gap-1.5">
                    {quickCategories.map((category, index) => (
                      <button
                        key={category.name}
                        type="button"
                        onClick={() => handleQuickCategory(category.name)}
                        style={{ animationDelay: `${index * 18}ms` }}
                        className={`category-cell group flex h-auto min-h-0 w-max min-w-[7.5rem] items-center gap-2 rounded-[1.1rem] border px-3 py-2 text-left text-slate-800 shadow-warm transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          selectedCategoryId && categories.find(c => c.id === selectedCategoryId)?.name === category.name
                            ? "border-primary ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
                            : "border-slate-900/10 hover:-translate-y-0.5 hover:border-slate-900/20"
                        } bg-gradient-to-br ${category.gradient}`}
                      >
                        <span className="text-3xl leading-none" aria-hidden="true">{category.emoji}</span>
                        <span className="block whitespace-nowrap text-sm font-bold leading-tight">{category.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="shrink-0">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-2 block">
                    Tên mặt hàng
                  </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={nameValue}
                  onChange={(e) => {
                    setNameValue(e.target.value);
                    setSelectedCategoryId(null);
                  }}
                  onKeyDown={handleNameKeyDown}
                  placeholder="Bạn mua gì?"
                  className="bg-transparent text-3xl font-display text-foreground placeholder:text-muted-foreground/40 outline-none w-full caret-primary"
                  autoComplete="off"
                  aria-label="Tên mặt hàng"
                />
                {/* Recommendation cloud */}
                {(() => {
                  const query = nameValue.toLowerCase().trim();
                  const filtered = query.length > 0
                    ? items.filter(i => i.name.toLowerCase().includes(query))
                    : items;
                  const sorted = [...filtered].sort((a, b) =>
                    (itemFrequency[b.id] || 0) - (itemFrequency[a.id] || 0)
                  );
                  const display = sorted.slice(0, 20);
                  return display.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-3 max-h-[18vh] overflow-auto">
                      {display.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setNameValue(item.name);
                            const cat = categories.find(c => c.id === item.category_id);
                            const sub = subCategories.find(s => s.id === item.sub_category_id);
                            const sup = suppliers.find(s => s.id === item.default_supplier_id);
                            setMatch({
                              itemId: item.id,
                              categoryName: cat?.name ?? "",
                              subCategoryName: sub?.name ?? "",
                              supplierName: sup?.name ?? "",
                              unitPrice: item.default_unit_price ?? 0,
                              unit: item.unit ?? "unit",
                              categoryId: item.category_id,
                              subCategoryId: item.sub_category_id,
                              subSubCategoryId: item.sub_sub_category_id,
                              supplierId: item.default_supplier_id,
                            });
                            setVerifyData({
                              itemName: item.name,
                              categoryName: cat?.name ?? "",
                              subCategoryName: sub?.name ?? "",
                              supplierName: sup?.name ?? "",
                              unitPrice: item.default_unit_price ?? 0,
                              unit: item.unit ?? "unit",
                              itemId: item.id,
                              categoryId: item.category_id ?? undefined,
                              subCategoryId: item.sub_category_id ?? undefined,
                              supplierId: item.default_supplier_id ?? undefined,
                            });
                            setPhase("amount");
                            setTimeout(() => amountRef.current?.focus(), 50);
                          }}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            query && item.name.toLowerCase() === query
                              ? "bg-primary/15 border-primary/40 text-primary font-medium"
                              : "bg-muted/60 border-border/40 text-foreground hover:bg-muted hover:border-border"
                          }`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  ) : query.length > 0 ? (
                    <p className="text-xs text-muted-foreground/60 mt-3">Không tìm thấy mặt hàng</p>
                  ) : null;
                })()}
                <button
                  onClick={handleNameConfirm}
                  disabled={!nameValue.trim()}
                  className="self-end mt-4 flex items-center gap-1 text-sm font-medium text-primary disabled:text-muted-foreground/30 transition-colors"
                  aria-label="Tiếp theo"
                >
                  Tiếp theo <ChevronRight className="h-4 w-4" />
                </button>
                </div>
              </div>
            )}

            {/* Amount + inline verify phase */}
            {phase === "amount" && !justSaved && (
              <AmountPhase
                nameValue={nameValue}
                amountValue={amountValue}
                setAmountValue={setAmountValue}
                amountRef={amountRef}
                match={match}
                verifyData={verifyData}
                setMatch={setMatch}
                setVerifyData={setVerifyData}
                onBack={() => { setPhase("name"); setTimeout(() => nameRef.current?.focus(), 50); }}
                onKeyDown={handleAmountKeyDown}
                onSave={handleSave}
              />
            )}
          </div>
        </div>
      )}

      {/* Purchase detail dialog */}
      <PurchaseDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        entry={detailEntry}
        getCategoryName={getCategoryName}
        getSupplierName={getSupplierName}
        onSave={async (id, updates) => {
          await supabase.from("sub_payments").update(updates).eq("id", id);
          setPaymentGroups(prev => prev.map(g => ({
            ...g,
            entries: g.entries.map(e =>
              e.sub_payment_id === id ? { ...e, ...updates } : e
            ),
            total: g.entries.reduce((s, e) => e.sub_payment_id === id ? s + updates.amount : s + e.amount, 0),
          })));
          const diff = updates.amount - (detailEntry?.amount || 0);
          setDayTotal(prev => prev + diff);
          setDetailOpen(false);
          toast.success("Updated");
        }}
      />
    </div>
  );
}
