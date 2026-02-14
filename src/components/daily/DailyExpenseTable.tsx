import { useState, useMemo, useCallback } from "react";
import { useExpenseStore } from "@/context/ExpenseContext";
import type { Payment, SubPayment, VerifyData } from "@/types/expense";
import QuickVerifyPopup from "./QuickVerifyPopup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronDown, ChevronRight, Camera } from "lucide-react";
import { format } from "date-fns";

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function DailyExpenseTable() {
  const store = useExpenseStore();
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate] = useState(today);

  const todayPayments = useMemo(() => store.getPaymentsByDate(selectedDate), [store, selectedDate]);

  // New item input
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [verifyData, setVerifyData] = useState<VerifyData | null>(null);
  const [pendingSubPayment, setPendingSubPayment] = useState<{ paymentId: string } | null>(null);
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());

  // New receipt
  const [showNewReceipt, setShowNewReceipt] = useState(false);
  const [receiptNote, setReceiptNote] = useState("");

  const createReceipt = useCallback(() => {
    const payment: Payment = {
      id: generateId(),
      date: selectedDate,
      time: format(new Date(), "HH:mm"),
      totalAmount: 0,
      subPayments: [],
      notes: receiptNote || undefined,
    };
    store.addPayment(payment);
    setReceiptNote("");
    setShowNewReceipt(false);
    setExpandedPayments(prev => new Set([...prev, payment.id]));
  }, [selectedDate, receiptNote, store]);

  const handleNameBlur = useCallback(() => {
    if (!newName.trim()) return;
    const matched = store.findItemByName(newName);
    if (matched) {
      const cat = store.categories.find(c => c.id === matched.categoryId);
      const sub = store.subCategories.find(s => s.id === matched.subCategoryId);
      const subSub = store.subCategories.find(s => s.id === matched.subSubCategoryId);
      const sup = store.suppliers.find(s => s.id === matched.defaultSupplierId);

      setVerifyData({
        itemName: matched.name,
        categoryName: cat?.name ?? "Uncategorized",
        subCategoryName: sub?.name ?? "—",
        subSubCategoryName: subSub?.name,
        supplierName: sup?.name ?? "Unknown",
        unitPrice: matched.defaultUnitPrice ?? 0,
        unit: matched.unit ?? "unit",
        itemId: matched.id,
        categoryId: matched.categoryId,
        subCategoryId: matched.subCategoryId,
        subSubCategoryId: matched.subSubCategoryId,
        supplierId: matched.defaultSupplierId,
      });
    }
  }, [newName, store]);

  const addExpenseItem = useCallback((paymentId?: string) => {
    if (!newName.trim() || !newAmount.trim()) return;
    const amount = Number(newAmount) || 0;

    const sub: SubPayment = {
      id: generateId(),
      paymentId: paymentId || "",
      itemName: newName.trim(),
      quantity: verifyData ? (amount / (verifyData.unitPrice || 1)) : 1,
      unitPrice: verifyData?.unitPrice ?? amount,
      amount,
      categoryId: verifyData?.categoryId,
      subCategoryId: verifyData?.subCategoryId,
      subSubCategoryId: verifyData?.subSubCategoryId,
      supplierId: verifyData?.supplierId,
      itemId: verifyData?.itemId,
    };

    if (paymentId) {
      store.addSubPayment(paymentId, sub);
    } else {
      // Create a quick receipt for standalone items
      const payment: Payment = {
        id: generateId(),
        date: selectedDate,
        time: format(new Date(), "HH:mm"),
        totalAmount: amount,
        subPayments: [{ ...sub, paymentId: "" }],
        supplierId: verifyData?.supplierId,
      };
      payment.subPayments[0].paymentId = payment.id;
      store.addPayment(payment);
    }

    setNewName("");
    setNewAmount("");
    setVerifyData(null);
    setPendingSubPayment(null);
  }, [newName, newAmount, verifyData, store, selectedDate]);

  const toggleExpand = (id: string) => {
    setExpandedPayments(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleVerifySave = useCallback((updated: VerifyData) => {
    setVerifyData(updated);
    // Also update the item's defaults
    if (updated.itemId) {
      store.updateItem(updated.itemId, { defaultUnitPrice: updated.unitPrice });
    }
  }, [store]);

  const totalToday = todayPayments.reduce((sum, p) => sum + p.totalAmount, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl text-foreground">Today's Expenses</h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(selectedDate), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Today</p>
          <p className="text-2xl font-display text-foreground">
            {totalToday.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Quick Add Row */}
      <div className="card-editorial p-5">
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Quick Add</p>
        <div className="flex gap-3">
          <Input
            placeholder="Item name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleNameBlur}
            className="flex-1"
            aria-label="Item name"
          />
          <Input
            placeholder="Amount"
            type="number"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            className="w-32"
            aria-label="Amount"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addExpenseItem(pendingSubPayment?.paymentId);
              }
            }}
          />
          <Button
            onClick={() => addExpenseItem(pendingSubPayment?.paymentId)}
            disabled={!newName.trim() || !newAmount.trim()}
            className="gap-1.5"
            aria-label="Add expense"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>

        {/* Quick Verify Popup */}
        {verifyData && (
          <QuickVerifyPopup
            data={verifyData}
            onSave={handleVerifySave}
            onDismiss={() => setVerifyData(null)}
          />
        )}
      </div>

      {/* Receipts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg text-foreground">Receipts</h2>
          <Button variant="warm" size="sm" onClick={() => setShowNewReceipt(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Receipt
          </Button>
        </div>

        {showNewReceipt && (
          <div className="card-editorial p-4 flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Receipt Note (optional)</label>
              <Input
                autoFocus
                placeholder="e.g. Morning market run"
                value={receiptNote}
                onChange={(e) => setReceiptNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createReceipt()}
              />
            </div>
            <Button onClick={createReceipt} size="sm">Create</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowNewReceipt(false)}>Cancel</Button>
          </div>
        )}

        {todayPayments.length === 0 && !showNewReceipt && (
          <div className="card-editorial p-12 text-center">
            <p className="text-muted-foreground">No expenses yet today</p>
            <p className="text-sm text-muted-foreground mt-1">
              Use Quick Add above or create a new receipt
            </p>
          </div>
        )}

        {todayPayments.map(payment => {
          const expanded = expandedPayments.has(payment.id);
          return (
            <div key={payment.id} className="card-editorial overflow-hidden">
              {/* Receipt Header */}
              <button
                onClick={() => toggleExpand(payment.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-left"
                aria-expanded={expanded}
              >
                <div className="flex items-center gap-3">
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className="font-medium text-sm">
                      {payment.notes || `Receipt — ${payment.time}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payment.subPayments.length} item{payment.subPayments.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {payment.receiptPhoto && <Camera className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-display text-lg">{payment.totalAmount.toLocaleString()}</span>
                </div>
              </button>

              {/* Sub-payments */}
              {expanded && (
                <div className="border-t border-border">
                  <table className="w-full" role="table" aria-label="Receipt items">
                    <thead>
                      <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                        <th className="text-left px-5 py-2 font-medium">Item</th>
                        <th className="text-right px-5 py-2 font-medium">Amount</th>
                        <th className="w-10 px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {payment.subPayments.map(sub => (
                        <tr key={sub.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3 text-sm">{sub.itemName}</td>
                          <td className="px-5 py-3 text-sm text-right font-medium">{sub.amount.toLocaleString()}</td>
                          <td className="px-2 py-3">
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Delete ${sub.itemName}`}>
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Add to this receipt */}
                  <div className="px-5 py-3 border-t border-border/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground gap-1"
                      onClick={() => setPendingSubPayment({ paymentId: payment.id })}
                    >
                      <Plus className="h-3 w-3" />
                      Add item to this receipt
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
