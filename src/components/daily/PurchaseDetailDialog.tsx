import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Pencil, Check, History } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import ClearFieldButton from "./ClearFieldButton";

interface PurchaseDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: {
    item_name: string;
    amount: number;
    category_id: string | null;
    supplier_id: string | null;
    sub_payment_id?: string;
  } | null;
  getCategoryName: (id: string | null) => string | undefined;
  getSupplierName: (id: string | null) => string | undefined;
  onSave?: (id: string, updates: { item_name: string; amount: number }) => void;
}

interface HistoryEntry {
  item_name: string;
  amount: number;
  date: string;
  supplier_name?: string;
}

interface PeriodGroup {
  label: string;
  total: number;
  count: number;
  entries: HistoryEntry[];
}

export default function PurchaseDetailDialog({
  open,
  onOpenChange,
  entry,
  getCategoryName,
  getSupplierName,
  onSave,
}: PurchaseDetailDialogProps) {
  const { user } = useAuth();
  const [view, setView] = useState<"details" | "history">("details");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [historyPeriod, setHistoryPeriod] = useState("week");
  const [historyGroups, setHistoryGroups] = useState<PeriodGroup[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (entry) {
      setEditName(entry.item_name);
      setEditAmount(String(entry.amount));
      setView("details");
      setEditingField(null);
    }
  }, [entry]);

  useEffect(() => {
    if (view !== "history" || !entry || !user) return;
    loadHistory();
  }, [view, historyPeriod, entry, user]);

  const loadHistory = async () => {
    if (!entry || !user) return;
    setLoadingHistory(true);

    const { data } = await supabase
      .from("sub_payments")
      .select("item_name, amount, created_at, supplier_id, payment_id, payments!inner(date)")
      .eq("user_id", user.id)
      .ilike("item_name", entry.item_name)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!data) {
      setLoadingHistory(false);
      return;
    }

    const now = new Date();
    const groups: PeriodGroup[] = [];

    const getPeriodBounds = (date: Date, period: string) => {
      switch (period) {
        case "week": return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
        case "month": return { start: startOfMonth(date), end: endOfMonth(date) };
        case "quarter": return { start: startOfQuarter(date), end: endOfQuarter(date) };
        case "year": return { start: startOfYear(date), end: endOfYear(date) };
        default: return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
      }
    };

    const formatLabel = (date: Date, period: string) => {
      switch (period) {
        case "week": return `Week of ${format(startOfWeek(date, { weekStartsOn: 1 }), "MMM d")}`;
        case "month": return format(date, "MMMM yyyy");
        case "quarter": return `Q${Math.ceil((date.getMonth() + 1) / 3)} ${date.getFullYear()}`;
        case "year": return String(date.getFullYear());
        default: return "";
      }
    };

    const groupMap = new Map<string, PeriodGroup>();

    for (const row of data) {
      const paymentData = row.payments as any;
      const date = new Date(paymentData?.date || row.created_at);
      const label = formatLabel(date, historyPeriod);

      if (!groupMap.has(label)) {
        groupMap.set(label, { label, total: 0, count: 0, entries: [] });
      }
      const g = groupMap.get(label)!;
      g.total += Number(row.amount);
      g.count++;
      g.entries.push({
        item_name: row.item_name,
        amount: Number(row.amount),
        date: paymentData?.date || format(new Date(row.created_at), "yyyy-MM-dd"),
      });
    }

    setHistoryGroups(Array.from(groupMap.values()));
    setLoadingHistory(false);
  };

  const handleSave = () => {
    if (!entry?.sub_payment_id || !onSave) return;
    onSave(entry.sub_payment_id, {
      item_name: editName,
      amount: Number(editAmount) || entry.amount,
    });
    setEditingField(null);
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{entry.item_name}</DialogTitle>
        </DialogHeader>

        {/* View toggle */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setView("details")}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
              view === "details" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setView("history")}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1 ${
              view === "history" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <History className="h-3 w-3" />
            History
          </button>
        </div>

        {/* Details view */}
        {view === "details" && (
          <div className="space-y-3 pt-1">
            {/* Name */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground min-w-[70px]">Name</span>
              {editingField === "name" ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <div className="relative flex-1">
                    <Input
                      autoFocus
                      className="h-8 text-sm pr-8"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    />
                    <ClearFieldButton
                      visible={editName.length > 0}
                      size="sm"
                      label="Xóa tên"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      onClear={() => setEditName("")}
                    />
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-1 justify-end">
                  <span className="text-sm font-medium">{editName}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingField("name")}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground min-w-[70px]">Amount</span>
              {editingField === "amount" ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <div className="relative flex-1">
                    <Input
                      autoFocus
                      type="number"
                      className="h-8 text-sm pr-8"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    />
                    <ClearFieldButton
                      visible={editAmount.length > 0}
                      size="sm"
                      label="Xóa số tiền"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      onClear={() => setEditAmount("")}
                    />
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-1 justify-end">
                  <span className="text-sm font-display tabular-nums">{Number(editAmount).toLocaleString()}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingField("amount")}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Category */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground min-w-[70px]">Category</span>
              <span className="text-sm">{getCategoryName(entry.category_id) || "—"}</span>
            </div>

            {/* Supplier */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground min-w-[70px]">Supplier</span>
              <span className="text-sm">{getSupplierName(entry.supplier_id) || "—"}</span>
            </div>
          </div>
        )}

        {/* History view */}
        {view === "history" && (
          <div className="pt-1">
            {/* Period selector */}
            <Tabs value={historyPeriod} onValueChange={setHistoryPeriod}>
              <TabsList className="w-full h-8">
                <TabsTrigger value="week" className="text-[10px] flex-1">Week</TabsTrigger>
                <TabsTrigger value="month" className="text-[10px] flex-1">Month</TabsTrigger>
                <TabsTrigger value="quarter" className="text-[10px] flex-1">Quarter</TabsTrigger>
                <TabsTrigger value="year" className="text-[10px] flex-1">Year</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mt-3 max-h-[40vh] overflow-auto space-y-3">
              {loadingHistory && (
                <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
              )}
              {!loadingHistory && historyGroups.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No past purchases found</p>
              )}
              {!loadingHistory && historyGroups.map((group) => (
                <div key={group.label} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">{group.label}</span>
                    <div className="text-right">
                      <span className="text-sm font-display tabular-nums">{group.total.toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">({group.count}x)</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {group.entries.map((e, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{format(new Date(e.date + "T00:00:00"), "MMM d")}</span>
                        <span className="tabular-nums">{e.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
