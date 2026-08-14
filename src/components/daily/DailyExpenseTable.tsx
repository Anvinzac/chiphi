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
import VendorPhase from "./VendorPhase";
import SchedulePhase from "./SchedulePhase";
import ReceiptPhase from "./ReceiptPhase";
import PurchaseDetailDialog from "./PurchaseDetailDialog";
import RangeDayPicker from "./RangeDayPicker";
import MoneyLabel from "./MoneyLabel";
import DaySection from "./DaySection";
import WeekPager, { type WeekPage } from "./WeekPager";
import BrandMenu from "@/components/BrandMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { VerifyData } from "@/types/expense";
import { getMockGroupsForRange, isMockPaymentId } from "@/lib/mockRangeData";
import { ensureMockVendors } from "@/lib/mockVendors";
import { lockBodyScroll } from "@/lib/focusWithoutScroll";
import { formatDayMonth, formatDayMonthRange } from "@/lib/formatDateVi";
import { applyDueExpenseSpans, createExpenseSpan } from "@/lib/applyExpenseSpans";
import { SPAN_PRESETS, splitAmountAcrossPeriods, type SpanPresetKey } from "@/lib/expenseSpan";
import { QUICK_CATEGORY_DETAILS, type CategoryFrequency } from "@/lib/categoryVisuals";
import {
  isReminderPaymentId,
  nextDueFrom,
  reminderDisplayDate,
  reminderPaymentId,
  scheduleMetaFromDate,
  type ExpenseScheduleRow,
  type PaymentMethodId,
  type ScheduleRepeat,
} from "@/lib/expenseSchedule";

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

type InputPhase = "name" | "amount" | "vendor" | "schedule" | "receipt" | "done";
type PagerPhase = "name" | "amount" | "vendor" | "schedule" | "receipt";

function pagerPhases(advanced: boolean): PagerPhase[] {
  return advanced
    ? ["name", "amount", "vendor", "schedule", "receipt"]
    : ["name", "amount", "vendor"];
}

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
  const todayStr = format(new Date(), "yyyy-MM-dd");
  /** Current kỳ is the newest — don't invent future ranges past today. */
  const maxPeriodOffset = useMemo(() => getPeriodOffsetForDate(new Date()), [todayStr]);
  const canShiftForward = periodOffset < maxPeriodOffset;
  const periodIsPast = periodEndStr < todayStr;
  const periodIsFuture = periodStartStr > todayStr;
  // Range: past periods → last day of kỳ; current → today. Never write a future date.
  const expenseDate =
    viewMode === "daily"
      ? selectedDate
      : periodIsPast
        ? periodEndStr
        : todayStr;
  const canAddExpense =
    !periodIsFuture &&
    expenseDate <= todayStr &&
    (viewMode !== "daily" || selectedDate <= todayStr);

  // Reference data
  const [items, setItems] = useState<DbItem[]>([]);
  const [categories, setCategories] = useState<QuickCategory[]>([]);
  const [subCategories, setSubCategories] = useState<{ id: string; name: string; category_id?: string | null }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; contact?: string | null }[]>([]);
  const [itemFrequency, setItemFrequency] = useState<Record<string, number>>({});
  const [supplierFrequency, setSupplierFrequency] = useState<Record<string, number>>({});

  // Day data - grouped by payment (stale-while-revalidate via paymentsCacheRef)
  const [paymentGroups, setPaymentGroups] = useState<PaymentGroupData[]>([]);
  const [dayTotal, setDayTotal] = useState(0);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [paymentsReady, setPaymentsReady] = useState(false);

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
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // UI state
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  // Panel starts closed: returning to this page must not auto-open the add panel
  const [cardExpanded, setCardExpanded] = useState(false);
  const [cardClosing, setCardClosing] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<PaymentEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState<string | null>(null);
  const [spanEnabled, setSpanEnabled] = useState(false);
  const [spanPreset, setSpanPreset] = useState<SpanPresetKey>("3m");
  const [spanCustomPeriods, setSpanCustomPeriods] = useState("3");
  const [dataTick, setDataTick] = useState(0);
  const [advancedEnabled, setAdvancedEnabled] = useState(false);
  const [scheduleRepeat, setScheduleRepeat] = useState<ScheduleRepeat>("none");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("cash");
  const [paymentMethodNote, setPaymentMethodNote] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [completingScheduleId, setCompletingScheduleId] = useState<string | null>(null);
  const [completingRepeat, setCompletingRepeat] = useState<Exclude<ScheduleRepeat, "none"> | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const pagerReadyRef = useRef(false);
  const advancedEnabledRef = useRef(advancedEnabled);
  advancedEnabledRef.current = advancedEnabled;
  const suppliersRef = useRef(suppliers);
  suppliersRef.current = suppliers;
  const paymentsCacheRef = useRef(
    new Map<string, { groups: PaymentGroupData[]; total: number }>(),
  );
  const paymentsKeyRef = useRef("");
  const paymentsLoadIdRef = useRef(0);
  const paymentsHydratedKeyRef = useRef<string | null>(null);

  const paymentsKey =
    viewMode === "daily"
      ? `daily:${selectedDate}`
      : `range:${periodStartStr}:${periodEndStr}`;
  paymentsKeyRef.current = paymentsKey;

  // Keep cache in sync with optimistic local edits for the visible period
  useEffect(() => {
    if (paymentsHydratedKeyRef.current !== paymentsKey) return;
    paymentsCacheRef.current.set(paymentsKey, {
      groups: paymentGroups,
      total: dayTotal,
    });
  }, [paymentGroups, dayTotal, paymentsKey]);

  useEffect(() => {
    if (!receiptFile) {
      setReceiptPreview(null);
      return;
    }
    const url = URL.createObjectURL(receiptFile);
    setReceiptPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [receiptFile]);
  useEffect(() => {
    if (suppliers.length === 0) return;
    setPaymentGroups(prev => {
      let changed = false;
      const next = prev.map(g => {
        const supplierId = g.entries.find(e => e.supplier_id)?.supplier_id;
        if (!supplierId) return g;
        const name = suppliers.find(s => s.id === supplierId)?.name || null;
        if (name === g.supplierName) return g;
        changed = true;
        return { ...g, supplierName: name };
      });
      return changed ? next : prev;
    });
  }, [suppliers]);
  const pagerSyncingRef = useRef(false);
  const lastTapRef = useRef(0);
  const nameValueRef = useRef(nameValue);
  nameValueRef.current = nameValue;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const HIGH_VALUE_THRESHOLD = 200000;
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
      const [itemsRes, catsRes, subsRes, vendors, freqRes, supFreqRes] = await Promise.all([
        supabase.from("items").select("*").eq("user_id", user.id),
        supabase.from("categories").select("id, name, frequency").eq("user_id", user.id),
        supabase.from("sub_categories").select("id, name, category_id").eq("user_id", user.id),
        ensureMockVendors(user.id).catch(() => [] as { id: string; name: string; contact: string | null }[]),
        supabase.from("sub_payments").select("item_id").eq("user_id", user.id).not("item_id", "is", null),
        supabase.from("sub_payments").select("supplier_id").eq("user_id", user.id).not("supplier_id", "is", null),
      ]);
      if (itemsRes.data) setItems(itemsRes.data);
      if (catsRes.data) {
        setCategories(catsRes.data.map(category => ({
          ...category,
          frequency: (category.frequency as CategoryFrequency) || "daily",
        })));
      }
      if (subsRes.data) setSubCategories(subsRes.data);
      setSuppliers(vendors.map(v => ({ id: v.id, name: v.name, contact: v.contact })));
      if (freqRes.data) {
        const freq: Record<string, number> = {};
        freqRes.data.forEach((r: { item_id: string | null }) => {
          if (r.item_id) freq[r.item_id] = (freq[r.item_id] || 0) + 1;
        });
        setItemFrequency(freq);
      }
      if (supFreqRes.data) {
        const freq: Record<string, number> = {};
        (supFreqRes.data as { supplier_id: string | null }[]).forEach(r => {
          if (r.supplier_id) freq[r.supplier_id] = (freq[r.supplier_id] || 0) + 1;
        });
        setSupplierFrequency(freq);
      }
    };
    load();
  }, [user]);

  // Load data for selected date or range — show cache immediately, refresh in background
  useEffect(() => {
    if (!user) return;

    const loadId = ++paymentsLoadIdRef.current;
    const key = paymentsKey;
    const cached = paymentsCacheRef.current.get(key);
    if (cached) {
      paymentsHydratedKeyRef.current = key;
      setPaymentGroups(cached.groups);
      setDayTotal(cached.total);
      setPaymentsReady(true);
      if (cached.groups.length > 0) {
        if (viewMode === "range") {
          const endPayments = cached.groups.filter(
            g => g.date === periodEndStr && !isMockPaymentId(g.paymentId) && !isReminderPaymentId(g.paymentId),
          );
          setActivePaymentId(
            endPayments.length > 0
              ? endPayments[endPayments.length - 1].paymentId
              : null,
          );
        } else {
          const lastReal = [...cached.groups].reverse().find(g => !isMockPaymentId(g.paymentId) && !isReminderPaymentId(g.paymentId));
          setActivePaymentId(lastReal?.paymentId ?? null);
        }
      } else {
        setActivePaymentId(null);
      }
    } else if (paymentsHydratedKeyRef.current !== key) {
      // Uncached period only — avoid wiping the list on same-key refreshes
      paymentsHydratedKeyRef.current = null;
      setPaymentGroups([]);
      setDayTotal(0);
      setActivePaymentId(null);
      setPaymentsReady(false);
    }

    const loadPayments = async () => {
      try {
        const posted = await applyDueExpenseSpans(user.id, todayStr);
        if (posted > 0 && loadId === paymentsLoadIdRef.current) {
          toast.message(`Đã ghi ${posted} kỳ chi tiêu chia sẵn`);
        }
      } catch (err: any) {
        // Tables may not exist until migration is applied
        if (!String(err?.message || "").includes("expense_spans")) {
          console.warn("applyDueExpenseSpans", err);
        }
      }

      if (loadId !== paymentsLoadIdRef.current) return;

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
      if (loadId !== paymentsLoadIdRef.current) return;

      const rangeStart = viewMode === "daily" ? selectedDate : periodStartStr;
      const rangeEnd = viewMode === "daily" ? selectedDate : periodEndStr;
      let dueSchedules: ExpenseScheduleRow[] = [];
      try {
        const { data: scheds, error: schedErr } = await supabase
          .from("expense_schedules")
          .select("*")
          .eq("user_id", user.id)
          .eq("active", true);
        if (!schedErr && scheds) {
          dueSchedules = (scheds as ExpenseScheduleRow[]).filter(s =>
            reminderDisplayDate(s.next_due, rangeStart, rangeEnd, todayStr),
          );
        }
      } catch {
        /* table may not exist until migration */
      }

      if (loadId !== paymentsLoadIdRef.current) return;

      const supplierList = suppliersRef.current;
      let groups: PaymentGroupData[] = [];
      let total = 0;

      if (payments && payments.length > 0) {
        groups = payments.map((p: any) => {
          const subs = (p.sub_payments as any[]) || [];
          const paymentTotal = subs.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
          total += paymentTotal;

          const supplierId = p.supplier_id || (subs.length > 0 ? subs[0].supplier_id : null);
          const supplierName = supplierId
            ? supplierList.find(s => s.id === supplierId)?.name || null
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

      if (dueSchedules.length > 0) {
        const rangeStart = viewMode === "daily" ? selectedDate : periodStartStr;
        const rangeEnd = viewMode === "daily" ? selectedDate : periodEndStr;
        for (const sched of dueSchedules) {
          const displayDate = reminderDisplayDate(sched.next_due, rangeStart, rangeEnd, todayStr);
          if (!displayDate) continue;
          groups.push({
            paymentId: reminderPaymentId(sched.id),
            supplierName: sched.supplier_id
              ? supplierList.find(s => s.id === sched.supplier_id)?.name || null
              : null,
            total: 0,
            date: displayDate,
            entries: [{
              item_name: sched.item_name,
              amount: Number(sched.last_amount) || 0,
              category_id: sched.category_id,
              supplier_id: sched.supplier_id,
              notes: sched.repeat === "monthly"
                ? "Nhắc mỗi tháng"
                : sched.repeat === "biweekly"
                  ? "Nhắc mỗi 2 tuần"
                  : "Nhắc mỗi tuần",
              isPending: true,
              scheduleId: sched.id,
              pendingRepeat: sched.repeat,
              paymentMethod: sched.payment_method,
            }],
          });
        }
        groups.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      }

      paymentsHydratedKeyRef.current = key;
      paymentsCacheRef.current.set(key, { groups, total });
      setPaymentGroups(groups);
      setDayTotal(total);
      setPaymentsReady(true);
      if (groups.length > 0) {
        if (viewMode === "range") {
          const endPayments = groups.filter(g => g.date === periodEndStr && !isMockPaymentId(g.paymentId) && !isReminderPaymentId(g.paymentId));
          setActivePaymentId(
            endPayments.length > 0 ? endPayments[endPayments.length - 1].paymentId : null
          );
        } else {
          const lastReal = [...groups].reverse().find(g => !isMockPaymentId(g.paymentId) && !isReminderPaymentId(g.paymentId));
          setActivePaymentId(lastReal?.paymentId ?? null);
        }
      } else {
        setActivePaymentId(null);
      }
    };
    loadPayments();
  }, [user, selectedDate, viewMode, periodStartStr, periodEndStr, todayStr, dataTick, paymentsKey]);

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

  const scrollPagerTo = useCallback((target: PagerPhase, smooth: boolean) => {
    const el = pagerRef.current;
    if (!el) return;
    const pages = pagerPhases(advancedEnabledRef.current);
    const pageIndex = Math.max(0, pages.indexOf(target));
    const left = pageIndex * el.clientWidth;
    if (Math.abs(el.scrollLeft - left) < 2) return;
    pagerSyncingRef.current = true;
    el.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
    window.setTimeout(() => {
      pagerSyncingRef.current = false;
    }, smooth ? 420 : 50);
  }, []);

  const handleNameConfirmRef = useRef<(() => void) | null>(null);
  const goToNamePhaseRef = useRef<(() => void) | null>(null);
  const goToAmountPhaseRef = useRef<(() => void) | null>(null);
  const goToVendorPhaseRef = useRef<(() => void) | null>(null);
  const goToSchedulePhaseRef = useRef<(() => void) | null>(null);
  const goToReceiptPhaseRef = useRef<(() => void) | null>(null);
  const pagerSettleTimerRef = useRef<number | null>(null);

  // Keep the paging scroll view in sync with phase (buttons / keyboard / save reset)
  useEffect(() => {
    if (!cardExpanded || justSaved || phase === "done") {
      if (!cardExpanded) pagerReadyRef.current = false;
      return;
    }
    const pages = pagerPhases(advancedEnabled);
    const target = (pages.includes(phase as PagerPhase) ? phase : "amount") as PagerPhase;
    const smooth = pagerReadyRef.current;
    const id = requestAnimationFrame(() => {
      scrollPagerTo(target, smooth);
      pagerReadyRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [phase, cardExpanded, justSaved, advancedEnabled, scrollPagerTo]);

  const settlePagerPage = useCallback(() => {
    if (pagerSyncingRef.current) return;
    const el = pagerRef.current;
    if (!el || el.clientWidth === 0) return;
    const pages = pagerPhases(advancedEnabledRef.current);
    const page = Math.min(pages.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth)));
    const target = pages[page];
    if (!nameValueRef.current.trim() && target !== "name") {
      scrollPagerTo("name", true);
      return;
    }
    if (target === phaseRef.current) return;
    if (target === "name") goToNamePhaseRef.current?.();
    else if (target === "amount") {
      if (phaseRef.current === "name") handleNameConfirmRef.current?.();
      else goToAmountPhaseRef.current?.();
    } else if (target === "vendor") {
      if (phaseRef.current === "name") handleNameConfirmRef.current?.();
      goToVendorPhaseRef.current?.();
    } else if (target === "schedule") {
      if (phaseRef.current === "name") handleNameConfirmRef.current?.();
      goToSchedulePhaseRef.current?.();
    } else if (target === "receipt") {
      if (phaseRef.current === "name") handleNameConfirmRef.current?.();
      goToReceiptPhaseRef.current?.();
    }
  }, [scrollPagerTo]);

  const schedulePagerSettle = useCallback(() => {
    if (pagerSettleTimerRef.current) window.clearTimeout(pagerSettleTimerRef.current);
    pagerSettleTimerRef.current = window.setTimeout(settlePagerPage, 90);
  }, [settlePagerPage]);

  const collapseCard = useCallback(() => {
    if (!cardExpanded || cardClosing) return;
    setDiscardOpen(false);
    setCardClosing(true);
    setTimeout(() => {
      setCardExpanded(false);
      setCardClosing(false);
    }, 300);
  }, [cardExpanded, cardClosing]);

  const requestCollapseCard = useCallback(() => {
    if (!cardExpanded || cardClosing || justSaved) {
      collapseCard();
      return;
    }
    setDiscardOpen(true);
  }, [cardExpanded, cardClosing, justSaved, collapseCard]);

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
    // Keep whatever was typed as the line name; only fall back to the category label when empty
    const itemLabel = nameValueRef.current.trim() || categoryName;
    setNameValue(itemLabel);
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
      itemName: itemLabel,
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
    if (!user || savingRef.current) return;
    if (expenseDate > todayStr || periodIsFuture) {
      toast.error("Không thể ghi chi tiêu trước ngày hôm nay");
      return;
    }
    // User types in thousands — multiply by 1000 to get real VND amount
    const entries = [...amountLines, { amount: amountValue, note: noteValue }]
      .map(l => ({ amount: (Number(l.amount) || 0) * 1000, note: l.note.trim() || null }))
      .filter(l => l.amount > 0);
    if (entries.length === 0) return;
    const amount = entries.reduce((s, l) => s + l.amount, 0);
    const combinedNote = entries.map(l => l.note).filter(Boolean).join(" · ") || null;

    savingRef.current = true;
    setSaving(true);

    const finishUi = () => {
      setPhase("done");
      setJustSaved(true);
      setTimeout(() => {
        collapseCard();
        setTimeout(() => {
          setNameValue("");
          setAmountValue("");
          setNoteValue("");
          setAmountLines([]);
          setSelectedCategoryId(null);
          setMatch(null);
          setVerifyData(null);
          setSpanEnabled(false);
          setSpanPreset("3m");
          setSpanCustomPeriods("3");
          setAdvancedEnabled(false);
          setScheduleRepeat("none");
          setPaymentMethod("cash");
          setPaymentMethodNote("");
          setReceiptFile(null);
          setCompletingScheduleId(null);
          setCompletingRepeat(null);
          setJustSaved(false);
          setPhase("name");
          pagerReadyRef.current = false;
        }, 300);
      }, 600);
    };

    try {
      if (spanEnabled) {
        const periodCount =
          spanPreset === "custom"
            ? Math.min(120, Math.max(2, Math.floor(Number(spanCustomPeriods) || 0)))
            : (SPAN_PRESETS.find(p => p.key === spanPreset)?.periods ?? 0);
        if (periodCount < 2) {
          toast.error("Chọn số kỳ từ 2 trở lên");
          return;
        }
        try {
          const result = await createExpenseSpan({
            userId: user.id,
            firstDate: expenseDate,
            totalAmount: amount,
            periodCount,
            meta: {
              item_name: nameValue.trim(),
              item_id: match?.itemId || null,
              category_id: match?.categoryId || null,
              sub_category_id: match?.subCategoryId || null,
              sub_sub_category_id: match?.subSubCategoryId || null,
              supplier_id: match?.supplierId || null,
              notes: combinedNote,
              unit_price: match?.unitPrice,
            },
          });
          if (!result) {
            toast.error("Không chia được số tiền");
            return;
          }
          toast.success(`Đã ghi kỳ 1/${result.periodCount}`);
          setDataTick(t => t + 1);
          finishUi();
        } catch (err: any) {
          toast.error(err.message || "Lưu chia kỳ thất bại — đã chạy migration chưa?");
        }
        return;
      }

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

      const subRows = entries.map(l => ({
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
        payment_method: paymentMethod,
        payment_method_note: paymentMethodNote.trim() || null,
      }));
      let { error } = await supabase.from("sub_payments").insert(subRows);
      if (error && String(error.message).includes("payment_method")) {
        const fallback = subRows.map(({ payment_method: _pm, payment_method_note: _note, ...rest }) => rest);
        const retry = await supabase.from("sub_payments").insert(fallback);
        error = retry.error;
      }

      if (error) {
        toast.error(error.message || "Lưu thất bại");
        return;
      }

      if (receiptFile && pid) {
        try {
          const ext = receiptFile.name.split(".").pop() || "jpg";
          const path = `${user.id}/${pid}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("receipt-photos")
            .upload(path, receiptFile, { contentType: receiptFile.type || "image/jpeg", upsert: false });
          if (upErr) throw upErr;
          await supabase.from("payments").update({ receipt_photo_path: path }).eq("id", pid);
        } catch (err: any) {
          toast.error(err?.message || "Không tải được ảnh biên lai");
        }
      }

      if (completingScheduleId) {
        const repeat =
          scheduleRepeat !== "none" ? scheduleRepeat : (completingRepeat ?? "monthly");
        try {
          await supabase
            .from("expense_schedules")
            .update({
              last_amount: amount,
              next_due: nextDueFrom(expenseDate, repeat),
              payment_method: paymentMethod,
              payment_method_note: paymentMethodNote.trim() || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", completingScheduleId);
        } catch {
          /* ignore */
        }
      } else if (scheduleRepeat !== "none") {
        try {
          const meta = scheduleMetaFromDate(expenseDate, scheduleRepeat);
          await supabase.from("expense_schedules").insert({
            user_id: user.id,
            item_name: nameValue.trim(),
            item_id: match?.itemId || null,
            category_id: match?.categoryId || null,
            sub_category_id: match?.subCategoryId || null,
            supplier_id: match?.supplierId || null,
            last_amount: amount,
            payment_method: paymentMethod,
            payment_method_note: paymentMethodNote.trim() || null,
            repeat: scheduleRepeat,
            next_due: meta.next_due,
            weekday: meta.weekday,
            month_day: meta.month_day,
          });
        } catch (err: any) {
          if (!String(err?.message || "").includes("expense_schedules")) {
            console.warn("expense_schedules", err);
          }
        }
      }

      if (match?.supplierId) {
        const sid = match.supplierId;
        setSupplierFrequency(prev => ({
          ...prev,
          [sid]: (prev[sid] || 0) + entries.length,
        }));
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
        const withoutRemind = completingScheduleId
          ? prev.filter(g => g.paymentId !== reminderPaymentId(completingScheduleId))
          : prev;
        const existing = withoutRemind.find(g => g.paymentId === pid);
        if (existing) {
          return withoutRemind.map(g =>
            g.paymentId === pid
              ? {
                  ...g,
                  entries: [...g.entries, ...newEntries],
                  total: g.total + amount,
                  supplierName: g.supplierName || (match?.supplierName || null),
                }
              : g,
          );
        }
        return [
          ...withoutRemind,
          {
            paymentId: pid!,
            supplierName: match?.supplierName || null,
            total: amount,
            date: viewMode === "range" ? expenseDate : undefined,
            entries: newEntries,
          },
        ];
      });
      setDayTotal(prev => prev + amount);
      finishUi();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    amountValue, noteValue, amountLines, nameValue, match, activePaymentId, user,
    expenseDate, todayStr, periodIsFuture, viewMode, collapseCard,
    spanEnabled, spanPreset, spanCustomPeriods,
    paymentMethod, paymentMethodNote, receiptFile, scheduleRepeat,
    completingScheduleId, completingRepeat,
  ]);

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      handleNameConfirm();
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!savingRef.current) handleSave();
    }
    if (e.key === "Backspace" && amountValue === "") {
      e.preventDefault();
      setNoteValue("");
      setPhase("name");
    }
  };

  const handleRangeDaySelect = (date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    if (key > todayStr) {
      toast.error("Không thể chọn ngày trong tương lai");
      return;
    }
    setSelectedDate(key);
    setViewMode("daily");
    setRangePickerOpen(false);
  };

  const handleViewFullRange = () => {
    setViewMode("range");
    setRangePickerOpen(false);
  };

  useEffect(() => {
    if (periodOffset > maxPeriodOffset) setPeriodOffset(maxPeriodOffset);
  }, [periodOffset, maxPeriodOffset]);

  const shiftPeriod = (delta: number) => {
    setPeriodOffset(prev => {
      const next = prev + delta;
      if (next > maxPeriodOffset) return prev;
      return next;
    });
    setViewMode("range");
    setRangePickerOpen(false);
  };

  const expandCard = useCallback(() => {
    if (!canAddExpense) {
      toast.error("Không thể ghi chi tiêu trước ngày hôm nay");
      return;
    }
    setCardExpanded(true);
    // Blur any focused field so iOS doesn't zoom / scroll on open
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, [canAddExpense]);

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
    if (!canAddExpense) {
      toast.error("Không thể ghi chi tiêu trước ngày hôm nay");
      return;
    }
    setActivePaymentId(null);
    setNameValue("");
    setAmountValue("");
    setNoteValue("");
    setSelectedCategoryId(null);
    setMatch(null);
    setVerifyData(null);
    setPhase("name");
    setAdvancedEnabled(false);
    setScheduleRepeat("none");
    setPaymentMethod("cash");
    setPaymentMethodNote("");
    setReceiptFile(null);
    setCompletingScheduleId(null);
    setCompletingRepeat(null);
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

  const goToAmountPhase = useCallback(() => {
    setPhase("amount");
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, []);
  goToAmountPhaseRef.current = goToAmountPhase;

  const goToVendorPhase = useCallback(() => {
    setPhase("vendor");
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, []);
  goToVendorPhaseRef.current = goToVendorPhase;

  const goToSchedulePhase = useCallback(() => {
    setAdvancedEnabled(true);
    setPhase("schedule");
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, []);
  goToSchedulePhaseRef.current = goToSchedulePhase;

  const goToReceiptPhase = useCallback(() => {
    setAdvancedEnabled(true);
    setPhase("receipt");
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, []);
  goToReceiptPhaseRef.current = goToReceiptPhase;

  const openAdvancedFromAmount = useCallback(() => {
    setAdvancedEnabled(true);
    setPhase("schedule");
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, []);

  const skipReminder = useCallback(async (paymentId: string, entry: PaymentEntry) => {
    if (!entry.scheduleId) return;
    const repeat = entry.pendingRepeat ?? "monthly";
    const { error } = await supabase
      .from("expense_schedules")
      .update({ next_due: nextDueFrom(todayStr, repeat), updated_at: new Date().toISOString() })
      .eq("id", entry.scheduleId);
    if (error) {
      toast.error(error.message || "Không bỏ qua được");
      return;
    }
    setPaymentGroups(prev => prev.filter(g => g.paymentId !== paymentId));
    toast.success("Đã bỏ qua kỳ này");
  }, [todayStr]);

  const openReminder = useCallback((entry: PaymentEntry) => {
    if (!canAddExpense) {
      toast.error("Không thể ghi chi tiêu trước ngày hôm nay");
      return;
    }
    setCompletingScheduleId(entry.scheduleId ?? null);
    setCompletingRepeat(entry.pendingRepeat ?? "monthly");
    setScheduleRepeat(entry.pendingRepeat ?? "monthly");
    setPaymentMethod((entry.paymentMethod as PaymentMethodId) || "cash");
    setNameValue(entry.item_name);
    setAmountValue("");
    setNoteValue("");
    setAmountLines([]);
    const cat = categories.find(c => c.id === entry.category_id);
    const sup = suppliers.find(s => s.id === entry.supplier_id);
    setMatch({
      itemId: "",
      categoryName: cat?.name ?? "",
      subCategoryName: "",
      supplierName: sup?.name ?? "",
      unitPrice: 0,
      unit: "unit",
      categoryId: entry.category_id,
      subCategoryId: null,
      subSubCategoryId: null,
      supplierId: entry.supplier_id,
    });
    setVerifyData({
      itemName: entry.item_name,
      categoryName: cat?.name ?? "",
      subCategoryName: "",
      supplierName: sup?.name ?? "",
      unitPrice: 0,
      unit: "unit",
      categoryId: entry.category_id ?? undefined,
      supplierId: entry.supplier_id ?? undefined,
    });
    setAdvancedEnabled(false);
    setPhase("amount");
    setCardExpanded(true);
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, [canAddExpense, categories, suppliers]);

  const applyVendorSelection = useCallback((vendor: { id: string | null; name: string }) => {
    setMatch(prev =>
      prev
        ? { ...prev, supplierId: vendor.id, supplierName: vendor.name }
        : {
            itemId: "",
            categoryName: "",
            subCategoryName: "",
            supplierName: vendor.name,
            unitPrice: 0,
            unit: "unit",
            categoryId: null,
            subCategoryId: null,
            subSubCategoryId: null,
            supplierId: vendor.id,
          },
    );
    setVerifyData(prev =>
      prev
        ? { ...prev, supplierId: vendor.id ?? undefined, supplierName: vendor.name }
        : {
            itemName: nameValue,
            categoryName: "",
            subCategoryName: "",
            supplierName: vendor.name,
            unitPrice: 0,
            unit: "unit",
            supplierId: vendor.id ?? undefined,
          },
    );
  }, [nameValue]);

  const createVendor = useCallback(
    async (name: string) => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("suppliers")
        .insert({ name: name.trim(), user_id: user.id })
        .select("id, name, contact")
        .single();
      if (error) {
        toast.error(error.message || "Không thêm được nhà cung cấp");
        return null;
      }
      if (data) {
        setSuppliers(prev =>
          [...prev, { id: data.id, name: data.name, contact: data.contact }].sort((a, b) =>
            a.name.localeCompare(b.name, "vi"),
          ),
        );
        return { id: data.id, name: data.name, contact: data.contact };
      }
      return null;
    },
    [user],
  );

  const frequentVendorIds = useMemo(
    () =>
      Object.entries(supplierFrequency)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id),
    [supplierFrequency],
  );

  const defaultVendorId = match?.supplierId ?? verifyData?.supplierId ?? null;

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
      setPeriodOffset(prev => {
        const next = prev + (dx > 0 ? -1 : 1);
        if (next > maxPeriodOffset) return prev;
        return next;
      });
      window.dispatchEvent(new Event("mise:page-slide"));
      return;
    }

    const current = new Date(selectedDate + "T00:00:00");
    const next = addDays(current, dx > 0 ? -1 : 1);
    if (next < period.start || next > period.end) return;
    const nextKey = format(next, "yyyy-MM-dd");
    if (nextKey > format(new Date(), "yyyy-MM-dd")) return;
    setSelectedDate(nextKey);
    window.dispatchEvent(new Event("mise:page-slide"));
  }, [selectedDate, viewMode, period.start, period.end, maxPeriodOffset]);

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
      onEntryClick={(entry) => {
        if (entry.isPending) openReminder(entry);
        else { setDetailEntry(entry); setDetailOpen(true); }
      }}
      onEntryNameClick={(entry) => {
        if (entry.isPending) openReminder(entry);
        else setNameFilter(entry.item_name);
      }}
      onEntryDelete={async (paymentId, entry, index) => {
        if (entry.isPending && entry.scheduleId) {
          await skipReminder(paymentId, entry);
          return;
        }
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
      onEntrySkip={skipReminder}
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
      {/* Top bar: brand | range | total — same gap on both sides of the date control */}
      <div
        className="topbar-surface sticky top-0 z-30 flex shrink-0 items-center gap-3 px-4 py-3"
        data-no-double-tap
      >
        <div className="shrink-0">
          <BrandMenu isDemo={isDemo} onSignOut={onSignOut} />
        </div>

        <Popover open={rangePickerOpen} onOpenChange={setRangePickerOpen}>
          <div className="flex h-9 min-w-0 flex-1 items-stretch overflow-hidden rounded-full border border-border/50 bg-muted/45 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="inline-flex w-[15%] shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground active:scale-95"
              aria-label="Previous period"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex w-[70%] min-w-0 flex-col items-center justify-center px-1 text-center transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
                aria-label="Open day picker for this period"
              >
                <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
                  {viewMode === "range" ? "Theo kỳ" : "Theo ngày"}
                </span>
                <span className="block max-w-full truncate text-sm font-display tabular-nums leading-tight text-foreground/90">
                  {centerLabel}
                </span>
              </button>
            </PopoverTrigger>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              disabled={!canShiftForward}
              className="inline-flex w-[15%] shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-25"
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

        <div className="min-w-[6.75rem] shrink-0 text-right tabular-nums">
          <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
            {nameFilter ? "Lọc" : "Tổng"}
          </span>
          <MoneyLabel
            amount={displayTotal}
            zeroDisplay="0.000.000"
            className="block text-lg font-display leading-tight"
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

        {paymentsReady && paymentGroups.length === 0 && (
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
                        isHighValue={!item.entry.isPending && item.entry.amount >= HIGH_VALUE_THRESHOLD}
                        isPending={item.entry.isPending}
                        onNameClick={() => {
                          if (item.entry.isPending) openReminder(item.entry);
                          else setNameFilter(item.entry.item_name);
                        }}
                        onClick={() => {
                          if (item.entry.isPending) openReminder(item.entry);
                          else { setDetailEntry(item.entry); setDetailOpen(true); }
                        }}
                        onDelete={async () => {
                          if (item.entry.isPending && item.entry.scheduleId) {
                            await skipReminder(item.paymentId, item.entry);
                            return;
                          }
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
                        onSkip={item.entry.isPending && item.entry.scheduleId
                          ? () => skipReminder(item.paymentId, item.entry)
                          : undefined}
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
        disabled={cardExpanded || !canAddExpense}
        tabIndex={cardExpanded || !canAddExpense ? -1 : 0}
        aria-hidden={cardExpanded}
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-opacity duration-200 ease-out ${
          cardExpanded || !canAddExpense
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
            requestCollapseCard();
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
              {pagerPhases(advancedEnabled).map(key => (
                <div
                  key={key}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-400 ${
                    phase === key || (phase === "done" && (key === "amount" || key === "receipt"))
                      ? "bg-primary"
                      : pagerPhases(advancedEnabled).indexOf(key) < pagerPhases(advancedEnabled).indexOf(phase as PagerPhase)
                        ? "bg-primary/30"
                        : "bg-muted"
                  }`}
                />
              ))}
            </div>
            {viewMode === "range" && periodIsPast && !justSaved && (
              <p className="px-5 pb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/75">
                Lưu vào ngày cuối kỳ · {formatDayMonth(period.end)}
              </p>
            )}
            {viewMode === "range" && !periodIsPast && !periodIsFuture && !justSaved && (
              <p className="px-5 pb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/75">
                Lưu vào hôm nay · {formatDayMonth(new Date())}
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
                        (() => {
                          const total =
                            [...amountLines, { amount: amountValue }].reduce(
                              (s, l) => s + (Number(l.amount) || 0) * 1000,
                              0
                            );
                          if (!spanEnabled) return total;
                          const n =
                            spanPreset === "custom"
                              ? Math.min(120, Math.max(2, Math.floor(Number(spanCustomPeriods) || 0)))
                              : (SPAN_PRESETS.find(p => p.key === spanPreset)?.periods ?? 0);
                          if (n < 2) return total;
                          return splitAmountAcrossPeriods(total, n)[0];
                        })()
                      }
                      className="text-2xl font-display"
                      smallClassName="text-[0.65em]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Horizontal paging: name | amount | vendor */}
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
                    onOpenVendor={goToVendorPhase}
                    onOpenAdvanced={openAdvancedFromAmount}
                    advancedEnabled={advancedEnabled}
                    onKeyDown={handleAmountKeyDown}
                    onSave={handleSave}
                    saving={saving}
                    noteSuggestions={noteSuggestions}
                    spanEnabled={spanEnabled}
                    setSpanEnabled={setSpanEnabled}
                    spanPreset={spanPreset}
                    setSpanPreset={setSpanPreset}
                    spanCustomPeriods={spanCustomPeriods}
                    setSpanCustomPeriods={setSpanCustomPeriods}
                  />
                </div>

                {/* Vendor page */}
                <div className="expense-phase-page flex h-full min-h-0 flex-col">
                  <VendorPhase
                    vendors={suppliers}
                    frequentVendorIds={frequentVendorIds}
                    defaultVendorId={
                      match?.itemId
                        ? items.find(i => i.id === match.itemId)?.default_supplier_id ?? null
                        : defaultVendorId
                    }
                    selectedVendorId={match?.supplierId ?? verifyData?.supplierId ?? null}
                    selectedVendorName={match?.supplierName || verifyData?.supplierName || ""}
                    onSelect={applyVendorSelection}
                    onCreate={createVendor}
                    onDone={goToAmountPhase}
                    onBack={goToAmountPhase}
                  />
                </div>

                {advancedEnabled && (
                  <>
                    <div className="expense-phase-page flex h-full min-h-0 flex-col">
                      <SchedulePhase
                        scheduleRepeat={scheduleRepeat}
                        setScheduleRepeat={setScheduleRepeat}
                        paymentMethod={paymentMethod}
                        setPaymentMethod={setPaymentMethod}
                        paymentMethodNote={paymentMethodNote}
                        setPaymentMethodNote={setPaymentMethodNote}
                        onBack={goToAmountPhase}
                        onNext={goToReceiptPhase}
                      />
                    </div>
                    <div className="expense-phase-page flex h-full min-h-0 flex-col">
                      <ReceiptPhase
                        previewUrl={receiptPreview}
                        onPickFile={setReceiptFile}
                        onBack={goToSchedulePhase}
                        onSave={handleSave}
                        saving={saving}
                        canSave={
                          !saving &&
                          ([...amountLines, { amount: amountValue }].some(l => Number(l.amount) > 0))
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {/* Confirm hide when tapping outside the add panel */}
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Ẩn bảng thêm chi tiêu?</AlertDialogTitle>
            <AlertDialogDescription>
              Chạm ra ngoài sẽ đóng bảng nhập. Bạn có thể tiếp tục nhập hoặc ẩn bảng đi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tiếp tục nhập</AlertDialogCancel>
            <AlertDialogAction onClick={collapseCard}>Ẩn bảng</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
