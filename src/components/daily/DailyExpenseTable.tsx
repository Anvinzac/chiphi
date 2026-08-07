import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { addDays, differenceInCalendarDays, endOfWeek, format, isToday, isYesterday, parseISO, startOfWeek } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import PaymentGroup, { type PaymentGroupData, type PaymentEntry } from "./PaymentGroup";
import SwipeableEntryRow from "./SwipeableEntryRow";
import ClearFieldButton from "./ClearFieldButton";
import AmountPhase from "./AmountPhase";
import PurchaseDetailDialog from "./PurchaseDetailDialog";
import RangeDayPicker from "./RangeDayPicker";
import MoneyLabel from "./MoneyLabel";
import DaySection from "./DaySection";
import WeekPager, { type WeekPage } from "./WeekPager";
import BrandMenu from "@/components/BrandMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { VerifyData } from "@/types/expense";
import { getMockGroupsForRange, isMockPaymentId } from "@/lib/mockRangeData";
import { lockBodyScroll } from "@/lib/focusWithoutScroll";
import { formatDayMonth, formatDayMonthRange } from "@/lib/formatDateVi";

type ViewMode = "range" | "daily";

interface DailyExpenseTableProps {
  isDemo?: boolean;
  onSignOut?: () => void;
}

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

export default function DailyExpenseTable({ isDemo, onSignOut }: DailyExpenseTableProps = {}) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("range");
  const [periodOffset, setPeriodOffset] = useState(() => getPeriodOffsetForDate(new Date()));
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const period = useMemo(() => getPeriodBounds(periodOffset), [periodOffset]);
  const periodStartStr = format(period.start, "yyyy-MM-dd");
  const periodEndStr = format(period.end, "yyyy-MM-dd");
  // Range mode: new spend lands on the period's last day (works for past periods too)
  const expenseDate = viewMode === "daily" ? selectedDate : periodEndStr;

  // Reference data
  const [items, setItems] = useState<DbItem[]>([]);
  const [categories, setCategories] = useState<QuickCategory[]>([]);
  const [subCategories, setSubCategories] = useState<{ id: string; name: string; category_id?: string | null }[]>([]);
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
  const [noteValue, setNoteValue] = useState("");
  const [amountLines, setAmountLines] = useState<{ amount: string; note: string }[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [verifyData, setVerifyData] = useState<VerifyData | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // UI state
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  // Panel starts closed: returning to this page must not auto-open the add panel
  const [cardExpanded, setCardExpanded] = useState(false);
  const [cardClosing, setCardClosing] = useState(false);
  const [detailEntry, setDetailEntry] = useState<PaymentEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const pagerReadyRef = useRef(false);
  const pagerSyncingRef = useRef(false);
  const lastTapRef = useRef(0);
  const nameValueRef = useRef(nameValue);
  nameValueRef.current = nameValue;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const HIGH_VALUE_THRESHOLD = 200000;
  // Soft dusty pastels — same visual weight across the set
  const QUICK_CATEGORY_DETAILS: { name: string; emoji: string; gradient: string; frequency: CategoryFrequency }[] = [
    { name: "Điện", emoji: "⚡", gradient: "linear-gradient(160deg, #efe4d2 0%, #d9c6a8 100%)", frequency: "monthly" },
    { name: "Thuê nhà", emoji: "🏠", gradient: "linear-gradient(160deg, #eedfe1 0%, #d8c0c4 100%)", frequency: "monthly" },
    { name: "Gas", emoji: "🔥", gradient: "linear-gradient(160deg, #f0ddd2 0%, #dbb9a8 100%)", frequency: "weekly" },
    { name: "Đi chợ", emoji: "🛒", gradient: "linear-gradient(160deg, #dde8dc 0%, #bdcfb9 100%)", frequency: "daily" },
    { name: "Bánh mì", emoji: "🥖", gradient: "linear-gradient(160deg, #f0e6d0 0%, #dbc8a6 100%)", frequency: "daily" },
    { name: "Nguyên vật liệu", emoji: "🥬", gradient: "linear-gradient(160deg, #e0ead8 0%, #c2d2b6 100%)", frequency: "daily" },
    { name: "Rau", emoji: "🥦", gradient: "linear-gradient(160deg, #dcead8 0%, #b8d0b0 100%)", frequency: "daily" },
    { name: "Đậu hũ", emoji: "🧈", gradient: "linear-gradient(160deg, #efe8d8 0%, #d8ceb4 100%)", frequency: "daily" },
    { name: "Nước tương", emoji: "🫙", gradient: "linear-gradient(160deg, #e8ddd0 0%, #d0bca8 100%)", frequency: "weekly" },
    { name: "Gạo", emoji: "🌾", gradient: "linear-gradient(160deg, #efe6d4 0%, #d8c8a8 100%)", frequency: "weekly" },
    { name: "Nước dừa", emoji: "🥥", gradient: "linear-gradient(160deg, #d9e6e6 0%, #b7cbcc 100%)", frequency: "weekly" },
    { name: "Muối", emoji: "🧂", gradient: "linear-gradient(160deg, #e2e6ea 0%, #c5cbd2 100%)", frequency: "weekly" },
    { name: "Shopee", emoji: "🛍️", gradient: "linear-gradient(160deg, #eeddd8 0%, #d6b8b0 100%)", frequency: "daily" },
    { name: "Internet", emoji: "🌐", gradient: "linear-gradient(160deg, #dde2ec 0%, #b8c2d2 100%)", frequency: "monthly" },
    { name: "Sửa chữa", emoji: "🛠️", gradient: "linear-gradient(160deg, #e8dfd8 0%, #cec0b4 100%)", frequency: "daily" },
    { name: "Vệ sinh", emoji: "🧼", gradient: "linear-gradient(160deg, #d8e8e6 0%, #b4cfcc 100%)", frequency: "daily" },
    { name: "Lương NV", emoji: "👥", gradient: "linear-gradient(160deg, #e4dde8 0%, #c8bdd2 100%)", frequency: "monthly" },
    { name: "Thuế", emoji: "🧾", gradient: "linear-gradient(160deg, #e0e4ea 0%, #c0c6d0 100%)", frequency: "monthly" },
    { name: "BHXH", emoji: "🛡️", gradient: "linear-gradient(160deg, #d8e6e0 0%, #b4cfc2 100%)", frequency: "monthly" },
    { name: "Rác", emoji: "♻️", gradient: "linear-gradient(160deg, #e4ead8 0%, #c6d0b4 100%)", frequency: "monthly" },
    { name: "Giữ xe", emoji: "🅿️", gradient: "linear-gradient(160deg, #e6e4e0 0%, #c8c6c2 100%)", frequency: "monthly" },
    { name: "Khác", emoji: "✦", gradient: "linear-gradient(160deg, #e8dde6 0%, #d0bac8 100%)", frequency: "daily" },
  ];
  const CHIP_FREQ_PAGES: { key: CategoryFrequency; label: string }[] = [
    { key: "monthly", label: "Tháng" },
    { key: "daily", label: "Ngày" },
    { key: "weekly", label: "Tuần" },
  ];
  const chipsByFrequency = useMemo(() => {
    const groups: Record<CategoryFrequency, typeof QUICK_CATEGORY_DETAILS> = {
      monthly: [],
      daily: [],
      weekly: [],
    };
    // Prefer DB frequency (Admin edits) over the hardcoded preset
    for (const detail of QUICK_CATEGORY_DETAILS) {
      const fromDb = categories.find(c => c.name.toLowerCase() === detail.name.toLowerCase());
      const freq = fromDb?.frequency || detail.frequency;
      groups[freq].push(detail);
    }
    return groups;
  }, [categories]);

  const [chipFreqPage, setChipFreqPage] = useState<CategoryFrequency>("daily");

  // Sub-categories of the active category — quick-tap note suggestions
  const noteSuggestions = useMemo(() => {
    const catId =
      selectedCategoryId ||
      match?.categoryId ||
      verifyData?.categoryId ||
      null;
    if (!catId) return [];
    return subCategories
      .filter(s => s.category_id === catId)
      .map(s => s.name);
  }, [selectedCategoryId, match, verifyData, subCategories]);
  const chipPagerRef = useRef<HTMLDivElement>(null);
  const chipPagerReadyRef = useRef(false);

  // Load reference data once
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [itemsRes, catsRes, subsRes, supsRes, freqRes] = await Promise.all([
        supabase.from("items").select("*").eq("user_id", user.id),
        supabase.from("categories").select("id, name, frequency").eq("user_id", user.id),
        supabase.from("sub_categories").select("id, name, category_id").eq("user_id", user.id),
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
        .select("id, date, total_amount, supplier_id, sub_payments(id, item_name, amount, category_id, supplier_id, notes)")
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
              notes: s.notes ?? null,
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
          const endPayments = groups.filter(g => g.date === periodEndStr && !isMockPaymentId(g.paymentId));
          setActivePaymentId(
            endPayments.length > 0 ? endPayments[endPayments.length - 1].paymentId : null
          );
        } else {
          const lastReal = [...groups].reverse().find(g => !isMockPaymentId(g.paymentId));
          setActivePaymentId(lastReal?.paymentId ?? null);
        }
      } else {
        setActivePaymentId(null);
      }
    };
    loadPayments();
  }, [user, selectedDate, suppliers, viewMode, periodStartStr, periodEndStr]);

  // Lock page scroll while the add panel is open (stops iOS jump-to-bottom on focus)
  useEffect(() => {
    if (!cardExpanded) return;
    return lockBodyScroll();
  }, [cardExpanded]);

  // Never auto-focus text fields on the name step — chips are the primary action
  useEffect(() => {
    if (!cardExpanded || phase !== "name") return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && cardRef.current?.contains(active)) {
      active.blur();
    }
  }, [cardExpanded, phase]);

  // Chip pager: monthly | daily | weekly — always open on daily (center)
  useEffect(() => {
    if (!cardExpanded || phase !== "name" || justSaved) {
      chipPagerReadyRef.current = false;
      return;
    }
    const el = chipPagerRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      const dailyIndex = CHIP_FREQ_PAGES.findIndex(p => p.key === "daily");
      el.scrollTo({ left: Math.max(0, dailyIndex) * el.clientWidth, behavior: "auto" });
      setChipFreqPage("daily");
      chipPagerReadyRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [cardExpanded, phase, justSaved]);

  const settleChipFreqPage = useCallback(() => {
    const el = chipPagerRef.current;
    if (!el || el.clientWidth === 0) return;
    const page = Math.min(
      CHIP_FREQ_PAGES.length - 1,
      Math.max(0, Math.round(el.scrollLeft / el.clientWidth)),
    );
    setChipFreqPage(CHIP_FREQ_PAGES[page].key);
  }, []);

  const scrollPagerTo = useCallback((target: "name" | "amount", smooth: boolean) => {
    const el = pagerRef.current;
    if (!el) return;
    const left = target === "amount" ? el.clientWidth : 0;
    if (Math.abs(el.scrollLeft - left) < 2) return;
    pagerSyncingRef.current = true;
    el.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
    window.setTimeout(() => {
      pagerSyncingRef.current = false;
    }, smooth ? 420 : 50);
  }, []);

  const handleNameConfirmRef = useRef<(() => void) | null>(null);
  const goToNamePhaseRef = useRef<(() => void) | null>(null);
  const pagerSettleTimerRef = useRef<number | null>(null);

  // Keep the paging scroll view in sync with phase (buttons / keyboard / save reset)
  useEffect(() => {
    if (!cardExpanded || justSaved || phase === "done") {
      if (!cardExpanded) pagerReadyRef.current = false;
      return;
    }
    const target = phase === "amount" ? "amount" : "name";
    const smooth = pagerReadyRef.current;
    // Wait a frame so the pager has layout after mount
    const id = requestAnimationFrame(() => {
      scrollPagerTo(target, smooth);
      pagerReadyRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [phase, cardExpanded, justSaved, scrollPagerTo]);

  const settlePagerPage = useCallback(() => {
    if (pagerSyncingRef.current) return;
    const el = pagerRef.current;
    if (!el || el.clientWidth === 0) return;
    const page = Math.round(el.scrollLeft / el.clientWidth);
    if (page >= 1) {
      if (!nameValueRef.current.trim()) {
        scrollPagerTo("name", true);
        return;
      }
      if (phaseRef.current !== "amount") {
        handleNameConfirmRef.current?.();
      }
    } else if (phaseRef.current === "amount") {
      goToNamePhaseRef.current?.();
    }
  }, [scrollPagerTo]);

  const schedulePagerSettle = useCallback(() => {
    if (pagerSettleTimerRef.current) window.clearTimeout(pagerSettleTimerRef.current);
    pagerSettleTimerRef.current = window.setTimeout(settlePagerPage, 90);
  }, [settlePagerPage]);

  const collapseCard = useCallback(() => {
    if (!cardExpanded || cardClosing) return;
    setCardClosing(true);
    setTimeout(() => {
      setCardExpanded(false);
      setCardClosing(false);
    }, 300);
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
      const preset = QUICK_CATEGORY_DETAILS.find(d => d.name.toLowerCase() === categoryName.toLowerCase());
      const frequency: CategoryFrequency = preset?.frequency || "daily";
      const { data, error } = await supabase
        .from("categories")
        .insert({ name: categoryName, user_id: user.id, frequency })
        .select("id, name, frequency")
        .single();
      if (error) {
        toast.error(error.message || "Không thể chọn danh mục");
        return;
      }
      if (data) {
        setCategories(prev => [...prev, {
          id: data.id,
          name: data.name,
          frequency: (data.frequency as CategoryFrequency) || frequency,
        }]);
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
    } else {
      setMatch(null);
      setVerifyData(null);
      setPhase("amount");
    }
  }, [nameValue, findItem, categories, subCategories, suppliers]);
  handleNameConfirmRef.current = handleNameConfirm;


  const handleSave = useCallback(async () => {
    if (!user) return;
    // User types in thousands — multiply by 1000 to get real VND amount
    const entries = [...amountLines, { amount: amountValue, note: noteValue }]
      .map(l => ({ amount: (Number(l.amount) || 0) * 1000, note: l.note.trim() || null }))
      .filter(l => l.amount > 0);
    if (entries.length === 0) return;
    const amount = entries.reduce((s, l) => s + l.amount, 0);

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

    const { error } = await supabase.from("sub_payments").insert(
      entries.map(l => ({
        payment_id: pid,
        item_name: nameValue.trim(),
        item_id: match?.itemId || null,
        quantity: match?.unitPrice ? l.amount / match.unitPrice : 1,
        unit_price: match?.unitPrice || l.amount,
        amount: l.amount,
        category_id: match?.categoryId || null,
        sub_category_id: match?.subCategoryId || null,
        sub_sub_category_id: match?.subSubCategoryId || null,
        supplier_id: match?.supplierId || null,
        notes: l.note,
        user_id: user.id,
      }))
    );

    if (error) {
      toast.error(error.message || "Lưu thất bại");
      return;
    }

    const newEntries: PaymentEntry[] = entries.map(l => ({
      item_name: nameValue.trim(),
      amount: l.amount,
      category_id: match?.categoryId || null,
      supplier_id: match?.supplierId || null,
      sub_payment_id: undefined,
      notes: l.note,
    }));

    // Update or create group
    setPaymentGroups(prev => {
      const existing = prev.find(g => g.paymentId === pid);
      if (existing) {
        return prev.map(g => g.paymentId === pid ? {
          ...g,
          entries: [...g.entries, ...newEntries],
          total: g.total + amount,
          supplierName: g.supplierName || (match?.supplierName || null),
        } : g);
      } else {
        return [...prev, {
          paymentId: pid!,
          supplierName: match?.supplierName || null,
          total: amount,
          date: viewMode === "range" ? expenseDate : undefined,
          entries: newEntries,
        }];
      }
    });
    setDayTotal(prev => prev + amount);

    setPhase("done");
    setJustSaved(true);
    setTimeout(() => {
      collapseCard();
      // Reset form after the card has finished sliding out
      setTimeout(() => {
        setNameValue("");
        setAmountValue("");
        setNoteValue("");
        setAmountLines([]);
        setSelectedCategoryId(null);
        setMatch(null);
        setVerifyData(null);
        setJustSaved(false);
        setPhase("name");
        pagerReadyRef.current = false;
      }, 300);
    }, 600);
  }, [amountValue, noteValue, amountLines, nameValue, match, activePaymentId, user, expenseDate, viewMode, collapseCard]);

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
      setNoteValue("");
      setPhase("name");
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
    // Blur any focused field so iOS doesn't zoom / scroll on open
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
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
    setNoteValue("");
    setSelectedCategoryId(null);
    setMatch(null);
    setVerifyData(null);
    setPhase("name");
    setCardExpanded(true);
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  };

  // Swipe between days (daily, within period) or periods (range)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const goToNamePhase = useCallback(() => {
    setNoteValue("");
    setPhase("name");
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, []);
  goToNamePhaseRef.current = goToNamePhase;

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
    ? formatDayMonthRange(period.start, period.end)
    : `${format(new Date(selectedDate + "T00:00:00"), "EEE", { locale: vi })}, ${formatDayMonth(new Date(selectedDate + "T00:00:00"))}`;

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

  type RangeDaySection = { date: string; groups: PaymentGroupData[]; total: number };

  // Split the range listing into one page per ISO week (Mon–Sun)
  const rangeWeekPages = useMemo<WeekPage<RangeDaySection>[]>(() => {
    if (viewMode !== "range") return [];
    const map = new Map<string, WeekPage<RangeDaySection>>();
    for (const section of rangeDaySections) {
      let d: Date;
      try {
        d = parseISO(section.date);
      } catch {
        continue;
      }
      if (Number.isNaN(d.getTime())) continue;
      const weekStart = startOfWeek(d, { weekStartsOn: 1 });
      const key = format(weekStart, "yyyy-MM-dd");
      let page = map.get(key);
      if (!page) {
        page = { key, weekStart, weekEnd: endOfWeek(d, { weekStartsOn: 1 }), total: 0, sections: [] };
        map.set(key, page);
      }
      page.total += section.total;
      page.sections.push(section);
    }
    return Array.from(map.values())
      .sort((a, b) => b.key.localeCompare(a.key))
      .map(page => ({
        ...page,
        sections: page.sections.sort((a, b) => b.date.localeCompare(a.date)),
      }));
  }, [viewMode, rangeDaySections]);

  const filteredNameSections = useMemo(() => {
    if (!nameFilter) return null;
    const needle = nameFilter.toLowerCase().trim();
    type FlatItem = {
      entry: PaymentEntry;
      paymentId: string;
      date: string;
      entryIndex: number;
    };
    const flat: FlatItem[] = [];
    for (const group of paymentGroups) {
      group.entries.forEach((entry, entryIndex) => {
        if (entry.item_name.toLowerCase().trim() === needle) {
          flat.push({
            entry,
            paymentId: group.paymentId,
            date: group.date || selectedDate,
            entryIndex,
          });
        }
      });
    }
    flat.sort((a, b) => b.date.localeCompare(a.date));

    type DayBucket = { date: string; total: number; items: FlatItem[] };
    type WeekBucket = {
      weekKey: string;
      weekStart: Date;
      weekEnd: Date;
      total: number;
      days: DayBucket[];
    };

    const weekMap = new Map<string, {
      weekStart: Date;
      weekEnd: Date;
      total: number;
      dayMap: Map<string, DayBucket>;
    }>();

    for (const item of flat) {
      const d = parseISO(item.date);
      const weekStart = startOfWeek(d, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(d, { weekStartsOn: 1 });
      const weekKey = format(weekStart, "yyyy-MM-dd");
      let week = weekMap.get(weekKey);
      if (!week) {
        week = { weekStart, weekEnd, total: 0, dayMap: new Map() };
        weekMap.set(weekKey, week);
      }
      week.total += item.entry.amount;
      let day = week.dayMap.get(item.date);
      if (!day) {
        day = { date: item.date, total: 0, items: [] };
        week.dayMap.set(item.date, day);
      }
      day.total += item.entry.amount;
      day.items.push(item);
    }

    const weeks: WeekBucket[] = Array.from(weekMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([weekKey, week]) => ({
        weekKey,
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        total: week.total,
        days: Array.from(week.dayMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
      }));

    return {
      total: flat.reduce((sum, item) => sum + item.entry.amount, 0),
      count: flat.length,
      weeks,
    };
  }, [nameFilter, paymentGroups, selectedDate]);

  const displayTotal = filteredNameSections ? filteredNameSections.total : dayTotal;

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

  const formatWeekHeading = (weekStart: Date, weekEnd: Date) => {
    return `Tuần ${formatDayMonth(weekStart)} – ${formatDayMonth(weekEnd)}`;
  };

  const renderPaymentGroup = (group: PaymentGroupData) => (
    <PaymentGroup
      key={group.paymentId}
      group={viewMode === "range" && !nameFilter ? { ...group, date: undefined } : group}
      getCategoryName={getCategoryName}
      getSupplierName={getSupplierName}
      highValueThreshold={HIGH_VALUE_THRESHOLD}
      onEntryClick={(entry) => { setDetailEntry(entry); setDetailOpen(true); }}
      onEntryNameClick={(entry) => setNameFilter(entry.item_name)}
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

  // Fixed height for both phases — paging must not resize the panel
  const panelHeight = "min(80svh, 36rem)";
  const listPadClass = cardExpanded ? "pb-[min(82svh,37rem)]" : "pb-24";

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleMainClick}
    >
      {/* Top bar: brand | centered range switcher | total */}
      <div
        className="topbar-surface sticky top-0 z-30 shrink-0 px-4 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2"
        data-no-double-tap
      >
        <BrandMenu isDemo={isDemo} onSignOut={onSignOut} />

        <Popover open={rangePickerOpen} onOpenChange={setRangePickerOpen}>
          <div className="flex items-center gap-1.5 justify-self-center">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted/55 text-muted-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.45)] transition-all hover:bg-muted hover:text-foreground active:scale-95"
              aria-label="Previous period"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="px-1.5 py-0.5 text-center transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-md"
                aria-label="Open day picker for this period"
              >
                <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
                  {viewMode === "range" ? "Theo kỳ" : "Theo ngày"}
                </span>
                <span className="block text-sm font-display tabular-nums leading-tight text-foreground/90">
                  {centerLabel}
                </span>
              </button>
            </PopoverTrigger>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted/55 text-muted-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.45)] transition-all hover:bg-muted hover:text-foreground active:scale-95"
              aria-label="Next period"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
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
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground block">
            {nameFilter ? "Lọc" : "Tổng"}
          </span>
          <MoneyLabel
            amount={displayTotal}
            className="text-lg font-display block leading-tight"
            smallClassName="text-[0.65em]"
          />
        </div>
      </div>

      {/* Grouped entries */}
      <div
        className={`flex-1 px-4 ${listPadClass} ${cardExpanded ? "overflow-hidden overscroll-none" : "overflow-auto"}`}
        data-expense-list
      >
        {nameFilter && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2" data-no-double-tap>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Đang lọc</p>
              <p className="truncate font-display text-base leading-tight">{nameFilter}</p>
            </div>
            <button
              type="button"
              onClick={() => setNameFilter(null)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
              aria-label="Xóa bộ lọc"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {paymentGroups.length === 0 && (
          <div className="text-center pt-12 text-muted-foreground text-sm">
            <p>Chưa có chi tiêu nào</p>
            {!cardExpanded && (
              <p className="text-[11px] mt-2 text-muted-foreground/70">Chạm đúp để thêm chi tiêu</p>
            )}
          </div>
        )}

        {filteredNameSections ? (
          filteredNameSections.count === 0 ? (
            <div className="text-center pt-10 text-sm text-muted-foreground">
              Không có khoản nào tên “{nameFilter}”
            </div>
          ) : (
            filteredNameSections.weeks.map(week => (
              <section key={week.weekKey} className="mb-6">
                <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
                  <h2 className="font-display text-sm tracking-wide text-muted-foreground">
                    {formatWeekHeading(week.weekStart, week.weekEnd)}
                  </h2>
                  <MoneyLabel
                    amount={week.total}
                    className="text-xs text-muted-foreground"
                    smallClassName="text-[0.7em]"
                  />
                </div>
                {week.days.map(day => (
                  <DaySection
                    key={day.date}
                    title={formatDayHeading(day.date)}
                    total={day.total}
                  >
                    {day.items.map(item => (
                      <SwipeableEntryRow
                        key={item.entry.sub_payment_id || `${item.paymentId}-${item.entryIndex}`}
                        item_name={item.entry.item_name}
                        amount={item.entry.amount}
                        notes={item.entry.notes}
                        categoryName={getCategoryName(item.entry.category_id)}
                        supplierName={getSupplierName(item.entry.supplier_id)}
                        isHighValue={item.entry.amount >= HIGH_VALUE_THRESHOLD}
                        onNameClick={() => setNameFilter(item.entry.item_name)}
                        onClick={() => { setDetailEntry(item.entry); setDetailOpen(true); }}
                        onDelete={async () => {
                          if (item.entry.sub_payment_id && !isMockPaymentId(item.paymentId)) {
                            await supabase.from("sub_payments").delete().eq("id", item.entry.sub_payment_id);
                          }
                          setPaymentGroups(prev => prev.map(g => {
                            if (g.paymentId !== item.paymentId) return g;
                            const newEntries = g.entries.filter((e, i) =>
                              item.entry.sub_payment_id
                                ? e.sub_payment_id !== item.entry.sub_payment_id
                                : i !== item.entryIndex
                            );
                            return { ...g, entries: newEntries, total: newEntries.reduce((s, e) => s + e.amount, 0) };
                          }).filter(g => g.entries.length > 0));
                          setDayTotal(prev => prev - item.entry.amount);
                          toast.success("Deleted");
                        }}
                      />
                    ))}
                  </DaySection>
                ))}
              </section>
            ))
          )
        ) : viewMode === "range" ? (
          <WeekPager
            weeks={rangeWeekPages}
            renderSection={(section) => (
              <DaySection
                key={section.date}
                title={formatDayHeading(section.date)}
                total={section.total}
              >
                {section.groups.map(renderPaymentGroup)}
              </DaySection>
            )}
          />
        ) : (
          paymentGroups.map(renderPaymentGroup)
        )}

        {/* New purchase button */}
        {paymentGroups.length > 0 && !nameFilter && (
          <button
            onClick={startNewPurchase}
            className="w-full mt-2 py-2.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg hover:border-primary/40 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Lần mua mới
          </button>
        )}
      </div>

      {/* FAB — always mounted; fades out in place while panel is open */}
      <button
        type="button"
        onClick={expandCard}
        disabled={cardExpanded}
        tabIndex={cardExpanded ? -1 : 0}
        aria-hidden={cardExpanded}
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-opacity duration-200 ease-out ${
          cardExpanded
            ? "opacity-0 pointer-events-none"
            : "opacity-100"
        }`}
        aria-label="Add expense"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Floating input card + dismiss scrim */}
      {cardExpanded && (
        <>
        <button
          type="button"
          className={`expense-add-scrim fixed inset-0 z-40 ${cardClosing ? "expense-scrim-exit" : "expense-scrim-enter"}`}
          aria-label="Đóng bảng thêm chi tiêu"
          onClick={(e) => {
            e.stopPropagation();
            collapseCard();
          }}
          onTouchStart={(e) => e.stopPropagation()}
        />
        <div
          ref={cardRef}
          className={`expense-add-panel fixed bottom-0 left-0 right-0 z-50 ${cardClosing ? "expense-card-exit" : "expense-card-enter"}`}
          style={{ height: panelHeight }}
          data-no-double-tap
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div
            className={`h-full rounded-t-2xl border-t border-border/60 flex flex-col transition-colors duration-400 overflow-hidden ${
              justSaved ? "bg-secondary/30" : "bg-card"
            }`}
            style={{ boxShadow: "0 -8px 40px -4px hsl(25 30% 20% / 0.10)" }}
          >
            {/* Phase indicator */}
            <div className="flex items-center gap-2 px-5 pt-4 pb-1 shrink-0">
              <div className={`h-1.5 flex-1 rounded-full transition-colors duration-400 ${
                phase === "name" ? "bg-primary" : "bg-primary/30"
              }`} />
              <div className={`h-1.5 flex-1 rounded-full transition-colors duration-400 ${
                phase === "amount" || phase === "done" ? "bg-primary" : "bg-muted"
              }`} />
            </div>
            {viewMode === "range" && !justSaved && (
              <p className="px-5 pb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/75">
                Lưu vào ngày cuối kỳ · {formatDayMonth(period.end)}
              </p>
            )}

            {/* Success flash */}
            {justSaved && (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-400">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <Check className="h-6 w-6 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-display">{nameValue}</p>
                    <MoneyLabel
                      amount={
                        [...amountLines, { amount: amountValue }].reduce(
                          (s, l) => s + (Number(l.amount) || 0) * 1000,
                          0
                        )
                      }
                      className="text-2xl font-display"
                      smallClassName="text-[0.65em]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Horizontal paging: name | amount */}
            {!justSaved && (
              <div
                ref={pagerRef}
                className="expense-phase-pager flex-1 min-h-0"
                onScroll={schedulePagerSettle}
                onTouchEnd={schedulePagerSettle}
              >
                {/* Name page */}
                <div className="expense-phase-page flex h-full min-h-0 flex-col px-5 pt-2 pb-3">
                  <div className="shrink-0">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-2 block">
                      Tên mặt hàng
                    </label>
                    <div className="flex items-center gap-2">
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
                        className="expense-name-input bg-transparent text-3xl font-display text-foreground placeholder:text-muted-foreground/40 outline-none w-full min-w-0 caret-primary"
                        autoComplete="off"
                        aria-label="Tên mặt hàng"
                        onFocus={() => {
                          window.scrollTo(0, 0);
                          requestAnimationFrame(() => window.scrollTo(0, 0));
                        }}
                      />
                      <ClearFieldButton
                        visible={nameValue.length > 0}
                        onClear={() => {
                          setNameValue("");
                          setSelectedCategoryId(null);
                          nameRef.current?.focus();
                        }}
                        label="Xóa tên mặt hàng"
                      />
                    </div>
                  </div>

                  <div className="shrink-0 pt-3 pb-2" data-no-double-tap>
                    <div className="mb-1.5 flex items-center justify-center gap-1" aria-hidden="true">
                      {CHIP_FREQ_PAGES.map(page => (
                        <span
                          key={page.key}
                          className={`h-1 rounded-full transition-all ${
                            chipFreqPage === page.key ? "w-3.5 bg-primary/70" : "w-1 bg-border"
                          }`}
                        />
                      ))}
                    </div>
                    <div
                      ref={chipPagerRef}
                      className="category-freq-pager -mx-5"
                      onScroll={settleChipFreqPage}
                      onTouchEnd={settleChipFreqPage}
                      aria-label="Danh mục theo chu kỳ"
                    >
                      {CHIP_FREQ_PAGES.map(page => (
                        <div
                          key={page.key}
                          className="category-freq-page"
                          role="list"
                          aria-label={`Danh mục ${page.label.toLowerCase()}`}
                        >
                          <div className="category-freq-track">
                            {chipsByFrequency[page.key].map((category, index) => {
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
                      ))}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden flex flex-col">
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
                        <div className="flex flex-wrap gap-2 mt-1 max-h-[18vh] overflow-auto">
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
                        <p className="text-xs text-muted-foreground/60 mt-1">Không tìm thấy mặt hàng</p>
                      ) : null;
                    })()}
                    <button
                      onClick={handleNameConfirm}
                      disabled={!nameValue.trim()}
                      className="self-end mt-auto flex items-center gap-1 text-sm font-medium text-primary disabled:text-muted-foreground/30 transition-colors"
                      aria-label="Tiếp theo"
                    >
                      Tiếp theo <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Amount page */}
                <div className="expense-phase-page flex h-full min-h-0 flex-col">
                  <AmountPhase
                    nameValue={nameValue}
                    amountValue={amountValue}
                    setAmountValue={setAmountValue}
                    noteValue={noteValue}
                    setNoteValue={setNoteValue}
                    lines={amountLines}
                    setLines={setAmountLines}
                    amountRef={amountRef}
                    match={match}
                    verifyData={verifyData}
                    setMatch={setMatch}
                    setVerifyData={setVerifyData}
                    onBack={goToNamePhase}
                    onKeyDown={handleAmountKeyDown}
                    onSave={handleSave}
                    noteSuggestions={noteSuggestions}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        </>
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
