import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, ChevronRight, ChevronDown, Plus } from "lucide-react";
import DayScroller from "./DayScroller";
import PaymentGroup, { type PaymentGroupData, type PaymentEntry } from "./PaymentGroup";
import QuickVerifyPopup from "./QuickVerifyPopup";
import PurchaseDetailDialog from "./PurchaseDetailDialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { VerifyData } from "@/types/expense";

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

type InputPhase = "name" | "verify" | "amount" | "done";

export default function DailyExpenseTable() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Reference data
  const [items, setItems] = useState<DbItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [subCategories, setSubCategories] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  // Day data - grouped by payment
  const [paymentGroups, setPaymentGroups] = useState<PaymentGroupData[]>([]);
  const [dayTotal, setDayTotal] = useState(0);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);

  // Input state
  const [phase, setPhase] = useState<InputPhase>("name");
  const [nameValue, setNameValue] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [verifyData, setVerifyData] = useState<VerifyData | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // UI state
  const [showDayScroller, setShowDayScroller] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(true);
  const [detailEntry, setDetailEntry] = useState<PaymentEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const HIGH_VALUE_THRESHOLD = 200000;

  // Load reference data once
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [itemsRes, catsRes, subsRes, supsRes] = await Promise.all([
        supabase.from("items").select("*").eq("user_id", user.id),
        supabase.from("categories").select("id, name").eq("user_id", user.id),
        supabase.from("sub_categories").select("id, name").eq("user_id", user.id),
        supabase.from("suppliers").select("id, name").eq("user_id", user.id),
      ]);
      if (itemsRes.data) setItems(itemsRes.data);
      if (catsRes.data) setCategories(catsRes.data);
      if (subsRes.data) setSubCategories(subsRes.data);
      if (supsRes.data) setSuppliers(supsRes.data);
    };
    load();
  }, [user]);

  // Load data for selected date - grouped by payment
  useEffect(() => {
    if (!user) return;
    setPaymentGroups([]);
    setDayTotal(0);
    setActivePaymentId(null);

    const loadDay = async () => {
      const { data: payments } = await supabase
        .from("payments")
        .select("id, total_amount, supplier_id, sub_payments(id, item_name, amount, category_id, supplier_id)")
        .eq("user_id", user.id)
        .eq("date", selectedDate)
        .order("created_at", { ascending: true });

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
            entries: subs.map((s: any) => ({
              item_name: s.item_name,
              amount: Number(s.amount),
              category_id: s.category_id,
              supplier_id: s.supplier_id,
              sub_payment_id: s.id,
            })),
          };
        });

        setPaymentGroups(groups);
        setDayTotal(total);
        setActivePaymentId(payments[payments.length - 1].id);
      }
    };
    loadDay();
  }, [user, selectedDate, suppliers]);

  useEffect(() => {
    if (phase === "name" && cardExpanded) nameRef.current?.focus();
  }, [phase, cardExpanded]);

  // Click outside card to collapse
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!cardExpanded) return;
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setCardExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [cardExpanded]);

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
      setPhase("verify");
    } else {
      setMatch(null);
      setVerifyData(null);
      setPhase("amount");
      setTimeout(() => amountRef.current?.focus(), 50);
    }
  }, [nameValue, findItem, categories, subCategories, suppliers]);

  const handleVerifyDismiss = useCallback(() => {
    // Auto-confirmed by countdown, proceed to amount
    setPhase("amount");
    setTimeout(() => amountRef.current?.focus(), 50);
  }, []);

  const handleVerifySave = useCallback((updated: VerifyData) => {
    // User edited and saved verify data, update match
    setMatch(prev => prev ? {
      ...prev,
      categoryName: updated.categoryName,
      subCategoryName: updated.subCategoryName,
      supplierName: updated.supplierName,
      unitPrice: updated.unitPrice,
      supplierId: updated.supplierId ?? prev.supplierId,
      categoryId: updated.categoryId ?? prev.categoryId,
      subCategoryId: updated.subCategoryId ?? prev.subCategoryId,
    } : null);
    setVerifyData(null);
    setPhase("amount");
    setTimeout(() => amountRef.current?.focus(), 50);
  }, []);

  const handleSave = useCallback(async () => {
    if (!amountValue.trim() || !user) return;
    const amount = Number(amountValue) || 0;
    if (amount === 0) return;

    let pid = activePaymentId;
    if (!pid) {
      const { data: newPayment } = await supabase
        .from("payments")
        .insert({ date: selectedDate, user_id: user.id, total_amount: 0, supplier_id: match?.supplierId || null })
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
      toast.error("Failed to save");
      return;
    }

    const newEntry: PaymentEntry = {
      item_name: nameValue.trim(),
      amount,
      category_id: match?.categoryId || null,
      supplier_id: match?.supplierId || null,
      sub_payment_id: undefined, // will get real id on reload
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
      setMatch(null);
      setVerifyData(null);
      setJustSaved(false);
      setPhase("name");
    }, 600);
  }, [amountValue, nameValue, match, activePaymentId, user, selectedDate]);

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

  const handleDateLabelClick = () => {
    setShowDayScroller(prev => !prev);
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(format(date, "yyyy-MM-dd"));
      setCalendarOpen(false);
      setShowDayScroller(false);
    }
  };

  const expandCard = () => {
    setCardExpanded(true);
    setTimeout(() => nameRef.current?.focus(), 100);
  };

  const startNewPurchase = () => {
    setActivePaymentId(null);
    setNameValue("");
    setAmountValue("");
    setMatch(null);
    setVerifyData(null);
    setPhase("name");
    setCardExpanded(true);
    setTimeout(() => nameRef.current?.focus(), 100);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="font-display text-xl text-primary">Mìsè</span>
        <div className="text-right">
          <button
            onClick={handleDateLabelClick}
            className="flex items-center gap-1.5 group"
          >
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">
              {format(new Date(selectedDate + "T00:00:00"), "EEE, MMM d")}
            </span>
            <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${showDayScroller ? "rotate-180" : ""}`} />
          </button>
          <span className="text-lg font-display block">{dayTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Day scroller */}
      {showDayScroller && (
        <div>
          <DayScroller
            selectedDate={selectedDate}
            onSelectDate={(d) => { setSelectedDate(d); setShowDayScroller(false); }}
            onRequestCalendar={() => setCalendarOpen(true)}
          />
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <span className="sr-only">Open calendar</span>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={new Date(selectedDate + "T00:00:00")}
                onSelect={handleCalendarSelect}
                disabled={(date) => date > new Date()}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Grouped entries */}
      <div className={`flex-1 overflow-auto px-4 ${cardExpanded ? "pb-[50vh]" : "pb-24"}`}>
        {paymentGroups.length === 0 && (
          <div className="text-center pt-12 text-muted-foreground text-sm">
            <p>No expenses recorded</p>
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
            New purchase
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
        <div ref={cardRef} className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 fade-in duration-250" style={{ height: "45vh" }}>
          <div
            className="absolute -top-8 left-0 right-0 h-8 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
          />

          <div
            className={`h-full rounded-t-2xl border-t border-border/60 flex flex-col transition-colors duration-300 overflow-auto ${
              justSaved ? "bg-secondary/30" : "bg-card"
            }`}
            style={{ boxShadow: "0 -8px 40px -4px hsl(25 30% 20% / 0.10)" }}
          >
            {/* Phase indicator */}
            <div className="flex items-center gap-2 px-5 pt-4 pb-1">
              <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                phase === "name" ? "bg-primary" : "bg-primary/30"
              }`} />
              <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                phase === "verify" ? "bg-primary" : phase === "amount" || phase === "done" ? "bg-primary/30" : "bg-muted"
              }`} />
              <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                phase === "amount" || phase === "done" ? "bg-primary" : "bg-muted"
              }`} />
            </div>

            {/* Success flash */}
            {justSaved && (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <Check className="h-6 w-6 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-display">{nameValue}</p>
                    <p className="text-2xl font-display">{Number(amountValue).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Name phase */}
            {phase === "name" && !justSaved && (
              <div className="flex-1 flex flex-col justify-center px-5">
                <label className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-2">
                  Item name
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  placeholder="What did you buy?"
                  className="bg-transparent text-3xl font-display text-foreground placeholder:text-muted-foreground/40 outline-none w-full caret-primary"
                  autoComplete="off"
                  aria-label="Item name"
                />
                {nameValue.length > 1 && (() => {
                  const hint = findItem(nameValue);
                  return hint ? (
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary" />
                      {hint.name}
                      {categories.find(c => c.id === hint.category_id)?.name && (
                        <span className="text-muted-foreground/60">
                          · {categories.find(c => c.id === hint.category_id)?.name}
                        </span>
                      )}
                    </p>
                  ) : null;
                })()}
                <button
                  onClick={handleNameConfirm}
                  disabled={!nameValue.trim()}
                  className="self-end mt-4 flex items-center gap-1 text-sm font-medium text-primary disabled:text-muted-foreground/30 transition-colors"
                  aria-label="Next"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Verify phase */}
            {phase === "verify" && verifyData && !justSaved && (
              <div className="flex-1 px-5 py-2 overflow-auto">
                <QuickVerifyPopup
                  data={verifyData}
                  onSave={handleVerifySave}
                  onDismiss={handleVerifyDismiss}
                />
              </div>
            )}

            {/* Amount phase */}
            {phase === "amount" && !justSaved && (
              <div className="flex-1 flex flex-col justify-center px-5">
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={() => { setPhase("name"); setTimeout(() => nameRef.current?.focus(), 50); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← {nameValue}
                  </button>
                  {match && (
                    <span className="text-[10px] text-muted-foreground">
                      Last: {match.unitPrice.toLocaleString()}/{match.unit}
                    </span>
                  )}
                </div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-2">
                  Amount
                </label>
                <input
                  ref={amountRef}
                  type="number"
                  inputMode="numeric"
                  value={amountValue}
                  onChange={(e) => setAmountValue(e.target.value)}
                  onKeyDown={handleAmountKeyDown}
                  placeholder="0"
                  className="bg-transparent text-5xl font-display text-foreground placeholder:text-muted-foreground/20 outline-none w-full caret-primary tabular-nums"
                  aria-label="Amount"
                />
                {match && (
                  <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
                    {match.supplierName && <span className="px-2 py-0.5 rounded-full bg-muted">{match.supplierName}</span>}
                    {match.categoryName && <span className="px-2 py-0.5 rounded-full bg-muted">{match.categoryName}</span>}
                    {match.subCategoryName && <span className="px-2 py-0.5 rounded-full bg-muted">{match.subCategoryName}</span>}
                  </div>
                )}
                <button
                  onClick={handleSave}
                  disabled={!amountValue.trim() || Number(amountValue) === 0}
                  className="self-end mt-4 flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-5 py-2.5 rounded-lg disabled:opacity-30 transition-opacity active:scale-95"
                  aria-label="Save"
                >
                  <Check className="h-4 w-4" />
                  Save
                </button>
              </div>
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
