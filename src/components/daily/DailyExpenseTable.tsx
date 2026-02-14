import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import QuickVerifyPopup from "./QuickVerifyPopup";
import { format } from "date-fns";
import { toast } from "sonner";
import type { VerifyData } from "@/types/expense";

interface ExpenseRow {
  id: string;
  itemName: string;
  amount: string;
  saved: boolean;
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

function newRow(): ExpenseRow {
  return { id: crypto.randomUUID(), itemName: "", amount: "", saved: false };
}

export default function DailyExpenseTable() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ExpenseRow[]>([newRow()]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [verifyData, setVerifyData] = useState<VerifyData | null>(null);
  const [verifyRowId, setVerifyRowId] = useState<string | null>(null);
  const [todayTotal, setTodayTotal] = useState(0);
  const [savedItems, setSavedItems] = useState<{ item_name: string; amount: number }[]>([]);
  const amountRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const nameRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [items, setItems] = useState<DbItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [subCategories, setSubCategories] = useState<{ id: string; name: string; parent_sub_category_id: string | null }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  // Active payment (receipt) for today
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  // Load reference data
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [itemsRes, catsRes, subsRes, supsRes] = await Promise.all([
        supabase.from("items").select("*").eq("user_id", user.id),
        supabase.from("categories").select("id, name").eq("user_id", user.id),
        supabase.from("sub_categories").select("id, name, parent_sub_category_id").eq("user_id", user.id),
        supabase.from("suppliers").select("id, name").eq("user_id", user.id),
      ]);
      if (itemsRes.data) setItems(itemsRes.data);
      if (catsRes.data) setCategories(catsRes.data);
      if (subsRes.data) setSubCategories(subsRes.data);
      if (supsRes.data) setSuppliers(supsRes.data);
    };
    load();
  }, [user]);

  // Load or create today's payment
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
        setSavedItems(subs.map((s: any) => ({ item_name: s.item_name, amount: Number(s.amount) })));
      }
    };
    loadToday();
  }, [user, today]);

  const findItem = useCallback((name: string): DbItem | undefined => {
    const lower = name.toLowerCase().trim();
    return items.find(i => i.name.toLowerCase() === lower) ||
      items.find(i => i.name.toLowerCase().includes(lower));
  }, [items]);

  const handleNameBlur = useCallback((rowId: string, name: string) => {
    if (!name.trim()) return;
    const matched = findItem(name);
    if (matched) {
      const cat = categories.find(c => c.id === matched.category_id);
      const sub = subCategories.find(s => s.id === matched.sub_category_id);
      const subSub = subCategories.find(s => s.id === matched.sub_sub_category_id);
      const sup = suppliers.find(s => s.id === matched.default_supplier_id);

      setVerifyData({
        itemName: matched.name,
        categoryName: cat?.name ?? "—",
        subCategoryName: sub?.name ?? "—",
        subSubCategoryName: subSub?.name,
        supplierName: sup?.name ?? "—",
        unitPrice: matched.default_unit_price ?? 0,
        unit: matched.unit ?? "unit",
        itemId: matched.id,
        categoryId: matched.category_id ?? undefined,
        subCategoryId: matched.sub_category_id ?? undefined,
        subSubCategoryId: matched.sub_sub_category_id ?? undefined,
        supplierId: matched.default_supplier_id ?? undefined,
      });
      setVerifyRowId(rowId);
    }
  }, [findItem, categories, subCategories, suppliers]);

  const handleAmountKeyDown = useCallback(async (e: React.KeyboardEvent, row: ExpenseRow, index: number) => {
    if (e.key !== "Enter" && e.key !== "Tab") return;
    if (!row.itemName.trim() || !row.amount.trim()) return;
    e.preventDefault();

    const amount = Number(row.amount) || 0;
    if (amount === 0) return;

    // Ensure payment exists
    let pid = paymentId;
    if (!pid && user) {
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

    if (!pid || !user) return;

    // Find matched item for metadata
    const matched = findItem(row.itemName);

    // Save sub-payment
    const { error } = await supabase.from("sub_payments").insert({
      payment_id: pid,
      item_name: row.itemName.trim(),
      item_id: matched?.id || null,
      quantity: matched?.default_unit_price ? amount / matched.default_unit_price : 1,
      unit_price: matched?.default_unit_price || amount,
      amount,
      category_id: matched?.category_id || null,
      sub_category_id: matched?.sub_category_id || null,
      sub_sub_category_id: matched?.sub_sub_category_id || null,
      supplier_id: matched?.default_supplier_id || null,
      user_id: user.id,
    });

    if (error) {
      toast.error("Failed to save");
      return;
    }

    // Mark row as saved and update totals
    setRows(prev => {
      const updated = prev.map(r => r.id === row.id ? { ...r, saved: true } : r);
      // Add new row if this is the last one
      if (index === updated.length - 1) {
        updated.push(newRow());
      }
      return updated;
    });

    setSavedItems(prev => [...prev, { item_name: row.itemName, amount }]);
    setTodayTotal(prev => prev + amount);

    // Focus next row's name input
    setTimeout(() => {
      const nextRow = rows[index + 1] || { id: "" };
      const nextId = index === rows.length - 1 ? "" : nextRow.id;
      // We need to wait for the new row to render
      setTimeout(() => {
        const allNameInputs = document.querySelectorAll<HTMLInputElement>('[data-role="item-name"]');
        const lastInput = allNameInputs[allNameInputs.length - 1];
        lastInput?.focus();
      }, 50);
    }, 0);
  }, [paymentId, user, today, findItem, rows]);

  const updateRow = (id: string, field: "itemName" | "amount", value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Compact header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-card">
        <span className="font-display text-lg text-primary">Mìsè</span>
        <div className="text-right">
          <span className="text-xs text-muted-foreground block leading-tight">{format(new Date(), "MMM d")}</span>
          <span className="text-sm font-display font-medium">{todayTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Quick verify popup - floats above table */}
      {verifyData && verifyRowId && (
        <div className="px-2 pt-1">
          <QuickVerifyPopup
            data={verifyData}
            onSave={(updated) => {
              setVerifyData(null);
              setVerifyRowId(null);
            }}
            onDismiss={() => {
              setVerifyData(null);
              setVerifyRowId(null);
            }}
          />
        </div>
      )}

      {/* Saved items list */}
      <div className="flex-1 overflow-auto">
        <table className="w-full" role="table" aria-label="Today's expenses">
          <thead>
            <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <th className="text-left px-3 py-2 font-medium">Item</th>
              <th className="text-right px-3 py-2 font-medium w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {/* Previously saved items */}
            {savedItems.map((item, i) => (
              <tr key={`saved-${i}`} className="border-b border-border/40">
                <td className="px-3 py-2.5 text-sm">{item.item_name}</td>
                <td className="px-3 py-2.5 text-sm text-right font-medium">{item.amount.toLocaleString()}</td>
              </tr>
            ))}

            {/* Active input rows */}
            {rows.filter(r => !r.saved).map((row, index) => (
              <tr key={row.id} className="border-b border-border/40">
                <td className="px-1 py-1">
                  <input
                    data-role="item-name"
                    ref={(el) => { if (el) nameRefs.current.set(row.id, el); }}
                    type="text"
                    placeholder="Item name..."
                    value={row.itemName}
                    onChange={(e) => updateRow(row.id, "itemName", e.target.value)}
                    onBlur={() => handleNameBlur(row.id, row.itemName)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        handleNameBlur(row.id, row.itemName);
                        amountRefs.current.get(row.id)?.focus();
                      }
                    }}
                    className="w-full bg-transparent text-sm px-2 py-2 outline-none focus:bg-muted/30 rounded"
                    autoFocus={index === 0 && savedItems.length === 0}
                    aria-label="Item name"
                  />
                </td>
                <td className="px-1 py-1 w-28">
                  <input
                    ref={(el) => { if (el) amountRefs.current.set(row.id, el); }}
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={row.amount}
                    onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                    onKeyDown={(e) => handleAmountKeyDown(e, row, savedItems.length + rows.filter(r => !r.saved).indexOf(row))}
                    className="w-full bg-transparent text-sm text-right px-2 py-2 outline-none focus:bg-muted/30 rounded font-medium"
                    aria-label="Amount"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
