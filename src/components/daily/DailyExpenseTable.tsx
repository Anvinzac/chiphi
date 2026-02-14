import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, ChevronRight } from "lucide-react";

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

interface SavedEntry {
  item_name: string;
  amount: number;
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

export default function DailyExpenseTable() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  // Data
  const [items, setItems] = useState<DbItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [subCategories, setSubCategories] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  // Input state
  const [phase, setPhase] = useState<InputPhase>("name");
  const [nameValue, setNameValue] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // Load reference data
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

  // Load today's data
  useEffect(() => {
    if (!user) return;
    const loadToday = async () => {
      const { data: existing } = await supabase
        .from("payments")
        .select("id, total_amount, sub_payments(id, item_name, amount)")
        .eq("user_id", user.id)
        .eq("date", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        setPaymentId(existing.id);
        setTodayTotal(Number(existing.total_amount) || 0);
        const subs = (existing.sub_payments as any[]) || [];
        setSavedEntries(subs.map((s: any) => ({ item_name: s.item_name, amount: Number(s.amount) })));
      }
    };
    loadToday();
  }, [user, today]);

  // Auto-focus name input on mount
  useEffect(() => {
    if (phase === "name") nameRef.current?.focus();
  }, [phase]);

  const findItem = useCallback((name: string): DbItem | undefined => {
    const lower = name.toLowerCase().trim();
    return items.find(i => i.name.toLowerCase() === lower) ||
      items.find(i => i.name.toLowerCase().includes(lower));
  }, [items]);

  const handleNameConfirm = useCallback(() => {
    if (!nameValue.trim()) return;
    const matched = findItem(nameValue);
    if (matched) {
      const cat = categories.find(c => c.id === matched.category_id);
      const sub = subCategories.find(s => s.id === matched.sub_category_id);
      const sup = suppliers.find(s => s.id === matched.default_supplier_id);
      setMatch({
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
      });
    } else {
      setMatch(null);
    }
    setPhase("amount");
    setTimeout(() => amountRef.current?.focus(), 50);
  }, [nameValue, findItem, categories, subCategories, suppliers]);

  const handleSave = useCallback(async () => {
    if (!amountValue.trim() || !user) return;
    const amount = Number(amountValue) || 0;
    if (amount === 0) return;

    // Ensure payment exists
    let pid = paymentId;
    if (!pid) {
      const { data: newPayment } = await supabase
        .from("payments")
        .insert({ date: today, user_id: user.id, total_amount: 0 })
        .select("id")
        .single();
      if (newPayment) {
        pid = newPayment.id;
        setPaymentId(pid);
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

    setSavedEntries(prev => [...prev, { item_name: nameValue.trim(), amount }]);
    setTodayTotal(prev => prev + amount);

    // Flash success
    setPhase("done");
    setJustSaved(true);
    setTimeout(() => {
      setNameValue("");
      setAmountValue("");
      setMatch(null);
      setJustSaved(false);
      setPhase("name");
    }, 600);
  }, [amountValue, nameValue, match, paymentId, user, today]);

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="font-display text-xl text-primary">Mìsè</span>
        <div className="text-right">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">{format(new Date(), "EEE, MMM d")}</span>
          <span className="text-lg font-display">{todayTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Saved entries - scrollable list behind the card */}
      <div className="flex-1 overflow-auto px-4 pb-[45vh]">
        {savedEntries.length === 0 && (
          <div className="text-center pt-12 text-muted-foreground text-sm">
            <p>No expenses today yet</p>
          </div>
        )}
        {savedEntries.map((entry, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-3 border-b border-border/40"
          >
            <span className="text-sm">{entry.item_name}</span>
            <span className="text-sm font-medium tabular-nums">{entry.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* ==================== THE FLOATING INPUT CARD ==================== */}
      <div className="fixed bottom-0 left-0 right-0 z-50" style={{ height: "42vh" }}>
        {/* Soft gradient fade above the card */}
        <div
          className="absolute -top-8 left-0 right-0 h-8 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
        />

        <div
          className={`h-full rounded-t-2xl border-t border-border/60 flex flex-col transition-colors duration-300 ${
            justSaved
              ? "bg-secondary/30"
              : "bg-card"
          }`}
          style={{ boxShadow: "0 -8px 40px -4px hsl(25 30% 20% / 0.10)" }}
        >
          {/* Phase indicator */}
          <div className="flex items-center gap-2 px-5 pt-4 pb-1">
            <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              phase === "name" ? "bg-primary" : "bg-primary/30"
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
              {/* Live match hint */}
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
              {/* Match metadata */}
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
    </div>
  );
}
