import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { addDays, differenceInCalendarDays, format, isToday, isYesterday, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import PaymentGroup, { type PaymentGroupData, type PaymentEntry } from "./PaymentGroup";
import AmountPhase from "./AmountPhase";
import PurchaseDetailDialog from "./PurchaseDetailDialog";
import RangeDayPicker from "./RangeDayPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { VerifyData } from "@/types/expense";
import { getMockGroupsForRange, isMockPaymentId } from "@/lib/mockRangeData";

type ViewMode = "range" | "daily";

/** Accounting periods: … → Jul 3–Aug 4 → Aug 5–Sep 3 → … */
const PERIOD_ZERO_START = new Date(2026, 7, 5); // Aug 5, 2026
const PERIOD_ZERO_END = new Date(2026, 8, 3); // Sep 3, 2026
const PERIOD_PREV_START = new Date(2026, 6, 3); // Jul 3, 2026
const PERIOD_PREV_END = new Date(2026, 7, 4); // Aug 4, 2026
const PERIOD_LENGTH_DAYS = 30;

function getPeriodBounds(offset: number) {
  if (offset === 0) return { start: PERIOD_ZERO_START, end: PERIOD_ZERO_END };
  if (offset === -1) return { start: PERIOD_PREV_START, end: PERIOD_PREV_END };
  if (offset > 0) {
    const start = addDays(PERIOD_ZERO_END, 1 + (offset - 1) * PERIOD_LENGTH_DAYS);
    return { start, end: addDays(start, PERIOD_LENGTH_DAYS - 1) };
  }
  // offset < -1: step backward from Jul 3 in 30-day chunks
  const start = addDays(PERIOD_PREV_START, (offset + 1) * PERIOD_LENGTH_DAYS);
  return { start, end: addDays(start, PERIOD_LENGTH_DAYS - 1) };
}

function getPeriodOffsetForDate(date: Date) {
  const key = format(date, "yyyy-MM-dd");
  if (key >= format(PERIOD_ZERO_START, "yyyy-MM-dd") && key <= format(PERIOD_ZERO_END, "yyyy-MM-dd")) {
    return 0;
  }
  if (key >= format(PERIOD_PREV_START, "yyyy-MM-dd") && key <= format(PERIOD_PREV_END, "yyyy-MM-dd")) {
    return -1;
  }
  if (key > format(PERIOD_ZERO_END, "yyyy-MM-dd")) {
    return 1 + Math.floor(differenceInCalendarDays(date, addDays(PERIOD_ZERO_END, 1)) / PERIOD_LENGTH_DAYS);
  }
  return -1 + Math.floor(differenceInCalendarDays(date, PERIOD_PREV_START) / PERIOD_LENGTH_DAYS);
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
  // Soft dusty pastels — same visual weight across the set
  const QUICK_CATEGORY_DETAILS: { name: string; emoji: string; gradient: string }[] = [
    { name: "Điện", emoji: "⚡", gradient: "linear-gradient(160deg, #efe4d2 0%, #d9c6a8 100%)" },
    { name: "Thuê nhà", emoji: "🏠", gradient: "linear-gradient(160deg, #eedfe1 0%, #d8c0c4 100%)" },
    { name: "Gas", emoji: "🔥", gradient: "linear-gradient(160deg, #f0ddd2 0%, #dbb9a8 100%)" },
    { name: "Đi chợ", emoji: "🛒", gradient: "linear-gradient(160deg, #dde8dc 0%, #bdcfb9 100%)" },
    { name: "Bánh mì", emoji: "🥖", gradient: "linear-gradient(160deg, #f0e6d0 0%, #dbc8a6 100%)" },
    { name: "Nguyên vật liệu", emoji: "🥬", gradient: "linear-gradient(160deg, #e0ead8 0%, #c2d2b6 100%)" },
    { name: "Rau", emoji: "🥦", gradient: "linear-gradient(160deg, #dcead8 0%, #b8d0b0 100%)" },
    { name: "Đậu hũ", emoji: "🧈", gradient: "linear-gradient(160deg, #efe8d8 0%, #d8ceb4 100%)" },
    { name: "Nước tương", emoji: "🫙", gradient: "linear-gradient(160deg, #e8ddd0 0%, #d0bca8 100%)" },
    { name: "Nước dừa", emoji: "🥥", gradient: "linear-gradient(160deg, #d9e6e6 0%, #b7cbcc 100%)" },
    { name: "Muối", emoji: "🧂", gradient: "linear-gradient(160deg, #e2e6ea 0%, #c5cbd2 100%)" },
    { name: "Shopee", emoji: "🛍️", gradient: "linear-gradient(160deg, #eeddd8 0%, #d6b8b0 100%)" },
    { name: "Internet", emoji: "🌐", gradient: "linear-gradient(160deg, #dde2ec 0%, #b8c2d2 100%)" },
    { name: "Sửa chữa", emoji: "🛠️", gradient: "linear-gradient(160deg, #e8dfd8 0%, #cec0b4 100%)" },
    { name: "Vệ sinh", emoji: "🧼", gradient: "linear-gradient(160deg, #d8e8e6 0%, #b4cfcc 100%)" },
    { name: "Lương NV", emoji: "👥", gradient: "linear-gradient(160deg, #e4dde8 0%, #c8bdd2 100%)" },
    { name: "Thuế", emoji: "🧾", gradient: "linear-gradient(160deg, #e0e4ea 0%, #c0c6d0 100%)" },
    { name: "BHXH", emoji: "🛡️", gradient: "linear-gradient(160deg, #d8e6e0 0%, #b4cfc2 100%)" },
    { name: "Rác", emoji: "♻️", gradient: "linear-gradient(160deg, #e4ead8 0%, #c6d0b4 100%)" },
    { name: "Giữ xe", emoji: "🅿️", gradient: "linear-gradient(160deg, #e6e4e0 0%, #c8c6c2 100%)" },
    { name: "Khác", emoji: "✦", gradient: "linear-gradient(160deg, #e8dde6 0%, #d0bac8 100%)" },
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

      let groups: PaymentGroupData[] = [];
      let total = 0;

      if (payments && payments.length > 0) {
        groups = payments.map((p: any) => {
          const subs = (p.sub_payments as any[]) || [];
          const paymentTotal = subs.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
          total += paymentTotal;

          const supplierId = p.supplier_id || (subs.length > 0 ? subs[0].supplier_id : null);
          const supplierName = supplierId
            ? suppliers.find(s => s.id === supplierId)?.name || null
            : null;

          return {
            paymentId: p.id,
            supplierName,
            total: paymentTotal,
            date: p.date as string,
            entries: subs.map((s: any) => ({
              item_name: s.item_name,
              amount: Number(s.amount),
              category_id: s.category_id,
              supplier_id: s.supplier_id,
              sub_payment_id: s.id,
            })),
          };
        });
      }

      // Inject client mock spend for empty (or sparse) previous-range testing
      if (viewMode === "range") {
        const mocks = getMockGroupsForRange(periodStartStr, periodEndStr);
        if (mocks.length > 0) {
          const realIds = new Set(groups.map(g => g.paymentId));
          const extra = mocks.filter(m => !realIds.has(m.paymentId));
          groups = [...groups, ...extra];
          total = groups.reduce((s, g) => s + g.total, 0);
        }
        groups.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      }

      setPaymentGroups(groups);
      setDayTotal(total);
      if (groups.length > 0) {
        if (viewMode === "range") {
          const todayStr = format(new Date(), "yyyy-MM-dd");
          const todayPayments = groups.filter(g => g.date === todayStr && !isMockPaymentId(g.paymentId));
          setActivePaymentId(
            todayPayments.length > 0 ? todayPayments[todayPayments.length - 1].paymentId : null
          );
        } else {
          const lastReal = [...groups].reverse().find(g => !isMockPaymentId(g.paymentId));
          setActivePaymentId(lastReal?.paymentId ?? null);
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
  const panelTouchStart = useRef<{ x: number; y: number; target: EventTarget | null } | null>(null);

  const goToNamePhase = useCallback(() => {
    setPhase("name");
    setTimeout(() => nameRef.current?.focus(), 50);
  }, []);

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

  const handlePanelTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    panelTouchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      target: e.target,
    };
  }, []);

  const handlePanelTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const start = panelTouchStart.current;
    panelTouchStart.current = null;
    if (!start || justSaved || phase === "done") return;

    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) * 0.65) return;

    // Don't steal horizontal scrolls from the category rail
    const el = start.target as HTMLElement | null;
    if (el?.closest(".category-rail")) return;

    if (dx < 0) {
      // swipe left → next phase
      if (phase === "name" && nameValue.trim()) handleNameConfirm();
    } else if (phase === "amount") {
      // swipe right → previous phase
      goToNamePhase();
    }
  }, [justSaved, phase, nameValue, handleNameConfirm, goToNamePhase]);

  const centerLabel = viewMode === "range"
    ? `${format(period.start, "MMM d")} – ${format(period.end, "MMM d")}`
    : format(new Date(selectedDate + "T00:00:00"), "EEE, MMM d");

  const rangeDaySections = useMemo(() => {
    if (viewMode !== "range") return [];
    const map = new Map<string, PaymentGroupData[]>();
    for (const group of paymentGroups) {
      const key = group.date || "unknown";
      const list = map.get(key);
      if (list) list.push(group);
      else map.set(key, [group]);
    }
    return Array.from(map.entries()).map(([date, groups]) => ({
      date,
      groups,
      total: groups.reduce((sum, g) => sum + g.total, 0),
    }));
  }, [viewMode, paymentGroups]);

  const formatDayHeading = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      if (isToday(d)) return "Hôm nay";
      if (isYesterday(d)) return "Hôm qua";
      return format(d, "EEEE, d MMMM", { locale: vi });
    } catch {
      return dateStr;
    }
  };

  const renderPaymentGroup = (group: PaymentGroupData) => (
    <PaymentGroup
      key={group.paymentId}
      group={viewMode === "range" ? { ...group, date: undefined } : group}
      getCategoryName={getCategoryName}
      getSupplierName={getSupplierName}
      highValueThreshold={HIGH_VALUE_THRESHOLD}
      onEntryClick={(entry) => { setDetailEntry(entry); setDetailOpen(true); }}
      onEntryDelete={async (paymentId, entry, index) => {
        if (entry.sub_payment_id && !isMockPaymentId(paymentId)) {
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
  );

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

        {viewMode === "range" ? (
          rangeDaySections.map(section => (
            <section key={section.date} className="mb-5">
              <div className="sticky top-0 z-10 -mx-1 mb-1.5 flex items-baseline justify-between gap-3 bg-background/95 px-1 py-2 backdrop-blur-sm">
                <h2 className="font-display text-base capitalize leading-none text-foreground">
                  {formatDayHeading(section.date)}
                </h2>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {section.total.toLocaleString("vi-VN")} ₫
                </span>
              </div>
              {section.groups.map(renderPaymentGroup)}
            </section>
          ))
        ) : (
          paymentGroups.map(renderPaymentGroup)
        )}

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
          onTouchStart={handlePanelTouchStart}
          onTouchEnd={handlePanelTouchEnd}
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
                <div className="category-rail -mx-5 shrink-0 overflow-x-auto px-5 pb-2.5" role="list" aria-label="Danh mục nhanh">
                  <div className="category-rail-track">
                    {quickCategories.map((category, index) => {
                      const selected =
                        selectedCategoryId &&
                        categories.find(c => c.id === selectedCategoryId)?.name === category.name;
                      return (
                        <button
                          key={category.name}
                          type="button"
                          onClick={() => handleQuickCategory(category.name)}
                          style={{
                            backgroundImage: category.gradient,
                            animationDelay: `${index * 16}ms`,
                          }}
                          className={`category-cell ${selected ? "category-cell--selected" : ""}`}
                          aria-pressed={!!selected}
                        >
                          <span className="category-cell__emoji" aria-hidden="true">{category.emoji}</span>
                          <span className="category-cell__label">{category.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
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
                onBack={goToNamePhase}
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
