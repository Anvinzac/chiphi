import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, ChevronDown, ChevronRight, Users, Tag, BarChart3, CalendarIcon, X, Check, ShoppingBasket, ClipboardCheck } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isWithinInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import type { Json } from "@/integrations/supabase/types";
import MoneyLabel from "@/components/daily/MoneyLabel";
import OrderCatalogAdmin from "@/components/admin/OrderCatalogAdmin";
import VendorsManager from "@/components/vendors/VendorsManager";

type AdminTab = "summary" | "pending" | "categories" | "subcategories" | "suppliers" | "items" | "orderCats" | "orderIngs";
type CategoryFrequency = "daily" | "weekly" | "monthly";

const CHART_COLORS = [
  "hsl(20, 50%, 53%)",
  "hsl(140, 18%, 67%)",
  "hsl(32, 40%, 71%)",
  "hsl(25, 12%, 45%)",
  "hsl(200, 25%, 60%)",
];

interface DbCategory { id: string; name: string; frequency: CategoryFrequency }
interface DbSubCategory { id: string; name: string; category_id: string; parent_sub_category_id: string | null }
interface DbSupplier { id: string; name: string; contact: string | null }
interface DbItem { id: string; name: string; category_id: string | null; default_supplier_id: string | null; default_unit_price: number | null; unit: string | null }
interface DbPayment { id: string; date: string; total_amount: number; sub_payments: { item_name: string; amount: number; category_id: string | null }[] }

type PendingLine = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  retail_price: number | null;
  money_amount: number | null;
  order_mode: string;
};

type PendingOrder = {
  order_id: string;
  title: string;
  customer_name: string | null;
  submitted_at: string;
  item_count: number;
  items: PendingLine[];
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("summary");
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [subCategories, setSubCategories] = useState<DbSubCategory[]>([]);
  const [suppliers, setSuppliers] = useState<DbSupplier[]>([]);
  const [items, setItems] = useState<DbItem[]>([]);
  const [payments, setPayments] = useState<DbPayment[]>([]);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [newCatName, setNewCatName] = useState("");
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemCat, setNewItemCat] = useState("");
  const [newItemSupplier, setNewItemSupplier] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("kg");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [subFilterCat, setSubFilterCat] = useState("");
  const [newSubCatId, setNewSubCatId] = useState("");
  const [newSubFlatName, setNewSubFlatName] = useState("");
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubName, setEditingSubName] = useState("");
  const [dataTick, setDataTick] = useState(0);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [pendingAmounts, setPendingAmounts] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    const onAccountData = () => setDataTick(n => n + 1);
    window.addEventListener("mise:account-data", onAccountData);
    return () => window.removeEventListener("mise:account-data", onAccountData);
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [c, sc, s, i, p] = await Promise.all([
        supabase.from("categories").select("id, name, frequency").eq("user_id", user.id),
        supabase.from("sub_categories").select("id, name, category_id, parent_sub_category_id").eq("user_id", user.id),
        supabase.from("suppliers").select("id, name, contact").eq("user_id", user.id),
        supabase.from("items").select("id, name, category_id, default_supplier_id, default_unit_price, unit").eq("user_id", user.id),
        supabase.from("payments").select("id, date, total_amount, sub_payments(item_name, amount, category_id)").eq("user_id", user.id),
      ]);
      if (c.data) setCategories(c.data as DbCategory[]);
      if (sc.data) setSubCategories(sc.data);
      if (s.data) setSuppliers(s.data);
      if (i.data) setItems(i.data);
      if (p.data) setPayments(p.data as any);
    };
    load();
  }, [user, dataTick]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const loadPending = async () => {
      const { data, error } = await supabase.rpc("list_pending_orders");
      if (!alive) return;
      if (error) return; // No kitchen accounts linked yet — stay silent.
      const rows = (data ?? []) as unknown as PendingOrder[];
      setPendingOrders(rows);
      // Seed the editable amount with whatever the order already carries.
      setPendingAmounts(prev => {
        const next = { ...prev };
        for (const row of rows) {
          for (const item of row.items ?? []) {
            if (next[item.id] === undefined) {
              next[item.id] = item.money_amount != null ? String(item.money_amount) : "";
            }
          }
        }
        return next;
      });
    };
    loadPending();
    return () => {
      alive = false;
    };
  }, [user, dataTick]);

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: "summary", label: "Summary", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "pending", label: "Chờ duyệt", icon: <ClipboardCheck className="h-4 w-4" /> },
    { key: "categories", label: "Categories", icon: <Tag className="h-4 w-4" /> },
    { key: "subcategories", label: "Sub-categories", icon: <Tag className="h-4 w-4" /> },
    { key: "suppliers", label: "Vendors", icon: <Users className="h-4 w-4" /> },
    { key: "items", label: "Items", icon: <Tag className="h-4 w-4" /> },
    { key: "orderCats", label: "Danh mục ĐH", icon: <ShoppingBasket className="h-4 w-4" /> },
    { key: "orderIngs", label: "Nguyên liệu ĐH", icon: <ShoppingBasket className="h-4 w-4" /> },
  ];

  const approvePending = async (order: PendingOrder) => {
    setReviewingId(order.order_id);
    try {
      const amounts: Record<string, number> = {};
      for (const item of order.items ?? []) {
        const raw = (pendingAmounts[item.id] ?? "").trim();
        const parsed = raw ? Number(raw) : NaN;
        if (Number.isFinite(parsed) && parsed > 0) amounts[item.id] = parsed;
      }
      const { error } = await supabase.rpc("approve_order", {
        p_order_id: order.order_id,
        p_amounts: amounts as unknown as Json,
      });
      if (error) throw error;
      toast.success("Đã duyệt — đã ghi chi phí");
      window.dispatchEvent(new Event("mise:account-data"));
      setPendingOrders(prev => prev.filter(o => o.order_id !== order.order_id));
    } catch (err: any) {
      toast.error(err.message || "Duyệt thất bại");
    } finally {
      setReviewingId(null);
    }
  };

  const rejectPending = async (order: PendingOrder) => {
    setReviewingId(order.order_id);
    try {
      const { error } = await supabase.rpc("reject_order", {
        p_order_id: order.order_id,
        p_note: rejectReason.trim() || null,
      });
      if (error) throw error;
      toast.success("Đã từ chối");
      setPendingOrders(prev => prev.filter(o => o.order_id !== order.order_id));
      setRejectingId(null);
      setRejectReason("");
    } catch (err: any) {
      toast.error(err.message || "Từ chối thất bại");
    } finally {
      setReviewingId(null);
    }
  };

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const monthInterval = { start: startOfMonth(today), end: endOfMonth(today) };
  const yearInterval = { start: startOfYear(today), end: endOfYear(today) };

  const filteredPayments = useMemo(() => {
    if (!dateRange?.from && !dateRange?.to) return payments;
    const from = dateRange.from;
    const to = dateRange.to || dateRange.from;
    return payments.filter(p => {
      try { return isWithinInterval(parseISO(p.date), { start: from!, end: to! }); } catch { return false; }
    });
  }, [payments, dateRange]);

  const rangeTotal = useMemo(() => filteredPayments.reduce((s, p) => s + Number(p.total_amount), 0), [filteredPayments]);

  const dailyTotal = useMemo(() => filteredPayments.filter(p => p.date === todayStr).reduce((s, p) => s + Number(p.total_amount), 0), [filteredPayments, todayStr]);
  const monthlyTotal = useMemo(() => filteredPayments.filter(p => { try { return isWithinInterval(parseISO(p.date), monthInterval); } catch { return false; } }).reduce((s, p) => s + Number(p.total_amount), 0), [filteredPayments]);
  const yearlyTotal = useMemo(() => filteredPayments.filter(p => { try { return isWithinInterval(parseISO(p.date), yearInterval); } catch { return false; } }).reduce((s, p) => s + Number(p.total_amount), 0), [filteredPayments]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredPayments.forEach(p => {
      (p.sub_payments || []).forEach((sp: any) => {
        const cat = categories.find(c => c.id === sp.category_id);
        const name = cat?.name ?? "Khác";
        map.set(name, (map.get(name) ?? 0) + Number(sp.amount));
      });
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [filteredPayments, categories]);

  const monthlyTrend = useMemo(() => {
    const months: { month: string; total: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const mStart = new Date(today.getFullYear(), m, 1);
      const mEnd = endOfMonth(mStart);
      const total = filteredPayments.filter(p => { try { return isWithinInterval(parseISO(p.date), { start: mStart, end: mEnd }); } catch { return false; } }).reduce((s, p) => s + Number(p.total_amount), 0);
      months.push({ month: format(mStart, "MMM"), total });
    }
    return months;
  }, [filteredPayments, today]);

  // CRUD helpers
  const addCategory = async () => {
    if (!newCatName.trim() || !user) return;
    const { data, error } = await supabase.from("categories").insert({ name: newCatName.trim(), user_id: user.id, frequency: "daily" }).select("id, name, frequency").single();
    if (error) { toast.error(error.message); return; }
    if (data) setCategories(prev => [...prev, data as DbCategory]);
    setNewCatName("");
  };

  const updateCategoryFrequency = async (id: string, frequency: CategoryFrequency) => {
    const { error } = await supabase.from("categories").update({ frequency }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories(prev => prev.map(category => category.id === id ? { ...category, frequency } : category));
  };

  const deleteCategory = async (id: string) => {
    await supabase.from("categories").delete().eq("id", id);
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const addSubCategory = async (categoryId: string, parentId?: string) => {
    if (!newSubName.trim() || !user) return;
    const { data, error } = await supabase.from("sub_categories").insert({
      name: newSubName.trim(), category_id: categoryId,
      parent_sub_category_id: parentId || null, user_id: user.id,
    }).select("id, name, category_id, parent_sub_category_id").single();
    if (error) { toast.error(error.message); return; }
    if (data) setSubCategories(prev => [...prev, data]);
    setNewSubName(""); setAddingSubTo(null);
  };

  const deleteSubCategory = async (id: string) => {
    await supabase.from("sub_categories").delete().eq("id", id);
    setSubCategories(prev => prev.filter(s => s.id !== id));
  };

  const addSubFlat = async () => {
    if (!newSubFlatName.trim() || !newSubCatId || !user) return;
    const { data, error } = await supabase.from("sub_categories").insert({
      name: newSubFlatName.trim(), category_id: newSubCatId,
      parent_sub_category_id: null, user_id: user.id,
    }).select("id, name, category_id, parent_sub_category_id").single();
    if (error) { toast.error(error.message); return; }
    if (data) setSubCategories(prev => [...prev, data]);
    setNewSubFlatName("");
  };

  const renameSubCategory = async (id: string) => {
    const name = editingSubName.trim();
    setEditingSubId(null);
    if (!name) return;
    const { error } = await supabase.from("sub_categories").update({ name }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSubCategories(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  };

  const addItem = async () => {
    if (!newItemName.trim() || !user) return;
    const { data, error } = await supabase.from("items").insert({
      name: newItemName.trim(), category_id: newItemCat || null,
      default_supplier_id: newItemSupplier || null,
      default_unit_price: Number(newItemPrice) || null,
      unit: newItemUnit || "unit", user_id: user.id,
    }).select("id, name, category_id, default_supplier_id, default_unit_price, unit").single();
    if (error) { toast.error(error.message); return; }
    if (data) setItems(prev => [...prev, data]);
    setNewItemName(""); setNewItemPrice("");
  };

  const deleteItem = async (id: string) => {
    await supabase.from("items").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const getLevel1Subs = (catId: string) => subCategories.filter(s => s.category_id === catId && !s.parent_sub_category_id);
  const getLevel2Subs = (subId: string) => subCategories.filter(s => s.parent_sub_category_id === subId);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg overflow-x-auto" role="tablist">
        {tabs.map(({ key, label, icon }) => (
          <button key={key} role="tab" aria-selected={activeTab === key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === key ? "bg-card text-foreground shadow-warm" : "text-muted-foreground hover:text-foreground"}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {activeTab === "summary" && (
        <div className="space-y-4">
          {/* Date Range Picker */}
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "MMM d, y")} – {format(dateRange.to, "MMM d, y")}</>
                    ) : (
                      format(dateRange.from, "MMM d, y")
                    )
                  ) : (
                    "Pick a date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            {dateRange && (
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setDateRange(undefined)}>
                <X className="h-3 w-3 mr-1" />Clear
              </Button>
            )}
          </div>

          {/* Range Total (only shown when filter is active) */}
          {dateRange && (
            <div className="card-editorial p-4 border-primary/30 bg-primary/5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {dateRange.to
                  ? `${format(dateRange.from!, "MMM d")} – ${format(dateRange.to, "MMM d, y")}`
                  : format(dateRange.from!, "MMM d, y")}
              </p>
              <MoneyLabel amount={rangeTotal} className="text-2xl font-display mt-1 block" suffix="" smallClassName="text-[0.65em]" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[{ label: "Today", value: dailyTotal }, { label: "This Month", value: monthlyTotal }, { label: "This Year", value: yearlyTotal }].map(({ label, value }) => (
              <div key={label} className="card-editorial p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                <MoneyLabel amount={value} className="text-2xl font-display mt-1 block" suffix="" smallClassName="text-[0.65em]" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-editorial p-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Monthly Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(30,15%,88%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(25,8%,45%)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(25,8%,45%)" />
                  <Tooltip contentStyle={{ background: "hsl(30,25%,98%)", border: "1px solid hsl(30,15%,85%)", borderRadius: "8px" }} />
                  <Bar dataKey="total" fill="hsl(20,50%,53%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card-editorial p-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">By Category</h3>
              {categoryBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart><Pie data={categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>{categoryBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              ) : <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === "pending" && (
        <div className="space-y-3">
          {pendingOrders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
              Không có đơn chờ duyệt
            </p>
          ) : (
            pendingOrders.map(order => {
              const lines = order.items ?? [];
              const busy = reviewingId === order.order_id;
              return (
                <div key={order.order_id} className="card-editorial p-4">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium">{order.title}</p>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {format(parseISO(order.submitted_at), "HH:mm dd/MM")}
                    </span>
                  </div>
                  <p className="mb-3 text-[11px] text-muted-foreground">
                    {order.customer_name?.trim() || "bếp"}
                    <span className="mx-1.5 text-border">·</span>
                    {order.item_count} món
                  </p>

                  <div className="mb-3 space-y-1.5">
                    {lines.map(item => (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {item.name}
                          {item.quantity != null && (
                            <span className="ml-1 text-[11px] text-muted-foreground">
                              {item.quantity}
                              {item.unit}
                            </span>
                          )}
                        </span>
                        <Input
                          value={pendingAmounts[item.id] ?? ""}
                          onChange={e =>
                            setPendingAmounts(prev => ({ ...prev, [item.id]: e.target.value }))
                          }
                          inputMode="decimal"
                          placeholder="0"
                          aria-label={`Số tiền ${item.name}`}
                          className="h-7 w-28 text-right text-sm tabular-nums"
                        />
                      </div>
                    ))}
                  </div>

                  {rejectingId === order.order_id ? (
                    <div className="space-y-2">
                      <Input
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Lý do từ chối (tuỳ chọn)"
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={busy}
                          onClick={() => {
                            setRejectingId(null);
                            setRejectReason("");
                          }}
                        >
                          Huỷ
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          disabled={busy}
                          onClick={() => void rejectPending(order)}
                        >
                          Xác nhận từ chối
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5"
                        disabled={busy}
                        onClick={() => void approvePending(order)}
                      >
                        <Check className="h-4 w-4" />
                        Duyệt
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        disabled={busy}
                        onClick={() => {
                          setRejectingId(order.order_id);
                          setRejectReason("");
                        }}
                      >
                        <X className="h-4 w-4" />
                        Từ chối
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "categories" && (
        <div className="space-y-3">
          <div className="card-editorial p-3 flex gap-2">
            <Input placeholder="New category..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} className="flex-1" />
            <Button onClick={addCategory} disabled={!newCatName.trim()} size="sm"><Plus className="h-4 w-4" /></Button>
          </div>
          {categories.map(cat => {
            const expanded = expandedCats.has(cat.id);
            const subs = getLevel1Subs(cat.id);
            return (
              <div key={cat.id} className="card-editorial overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <button onClick={() => setExpandedCats(prev => { const n = new Set(prev); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n; })} className="flex items-center gap-2 text-sm font-medium flex-1 text-left">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}{cat.name}
                  </button>
                  <div className="flex items-center gap-1 text-xs">
                    {(["daily", "weekly", "monthly"] as CategoryFrequency[]).map(freq => {
                      const labels: Record<CategoryFrequency, string> = { daily: "D", weekly: "W", monthly: "M" };
                      return (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => cat.frequency !== freq && updateCategoryFrequency(cat.id, freq)}
                          aria-pressed={cat.frequency === freq}
                          className={`h-7 px-2 rounded-md border text-xs font-medium transition-all ${
                            cat.frequency === freq
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/60 bg-muted/50 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {labels[freq]}
                        </button>
                      );
                    })}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteCategory(cat.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                {expanded && (
                  <div className="border-t border-border pl-8 pr-4 py-2 space-y-1">
                    {subs.map(sub => {
                      const l2 = getLevel2Subs(sub.id);
                      return (
                        <div key={sub.id}>
                          <div className="flex items-center justify-between py-1 text-sm">
                            <span>{sub.name}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSubCategory(sub.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                          {l2.map(ss => (
                            <div key={ss.id} className="flex items-center justify-between py-0.5 text-sm text-muted-foreground pl-4">
                              <span>{ss.name}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSubCategory(ss.id)}><Trash2 className="h-2.5 w-2.5" /></Button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {addingSubTo === cat.id ? (
                      <div className="flex gap-2 py-1">
                        <Input autoFocus className="h-7 text-sm" placeholder="Sub-category..." value={newSubName} onChange={(e) => setNewSubName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") addSubCategory(cat.id); }} />
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setAddingSubTo(cat.id)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "subcategories" && (
        <div className="space-y-3">
          <div className="card-editorial p-3 flex gap-2 flex-wrap">
            <select value={newSubCatId} onChange={(e) => setNewSubCatId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Parent category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Input placeholder="New sub-category..." value={newSubFlatName} onChange={(e) => setNewSubFlatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubFlat()} className="flex-1 min-w-[140px]" />
            <Button onClick={addSubFlat} disabled={!newSubFlatName.trim() || !newSubCatId} size="sm"><Plus className="h-4 w-4" /></Button>
          </div>

          <div className="flex items-center gap-2">
            <select value={subFilterCat} onChange={(e) => setSubFilterCat(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">All categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="text-xs text-muted-foreground">{subCategories.filter(s => !subFilterCat || s.category_id === subFilterCat).length} sub-categories</span>
          </div>

          {categories.filter(c => !subFilterCat || c.id === subFilterCat).map(cat => {
            const subs = getLevel1Subs(cat.id);
            return (
              <div key={cat.id} className="card-editorial overflow-hidden">
                <div className="px-4 py-2 border-b border-border/60 text-sm font-medium flex items-center justify-between">
                  <span>{cat.name}</span>
                  <span className="text-xs text-muted-foreground">{subs.length}</span>
                </div>
                <div className="divide-y divide-border/40">
                  {subs.length === 0 && <p className="px-4 py-2 text-sm text-muted-foreground">No sub-categories</p>}
                  {subs.map(sub => (
                    <div key={sub.id}>
                      <div className="flex items-center gap-2 px-4 py-1.5 text-sm">
                        {editingSubId === sub.id ? (
                          <Input autoFocus className="h-7 text-sm flex-1" value={editingSubName}
                            onChange={(e) => setEditingSubName(e.target.value)}
                            onBlur={() => renameSubCategory(sub.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") renameSubCategory(sub.id); if (e.key === "Escape") setEditingSubId(null); }} />
                        ) : (
                          <button className="flex-1 text-left hover:text-primary" onClick={() => { setEditingSubId(sub.id); setEditingSubName(sub.name); }}>{sub.name}</button>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSubCategory(sub.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                      {getLevel2Subs(sub.id).map(ss => (
                        <div key={ss.id} className="flex items-center gap-2 pl-9 pr-4 py-1 text-sm text-muted-foreground">
                          <span className="flex-1">{ss.name}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSubCategory(ss.id)}><Trash2 className="h-2.5 w-2.5" /></Button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "suppliers" && user && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Nhà cung cấp dùng khi thêm chi tiêu (mặc định / thường dùng).
            </p>
            <a href="/vendors" className="text-xs text-primary hover:underline shrink-0">
              Trang đầy đủ
            </a>
          </div>
          <VendorsManager
            userId={user.id}
            compact
            onVendorsChange={rows =>
              setSuppliers(rows.map(r => ({ id: r.id, name: r.name, contact: r.contact })))
            }
          />
        </div>
      )}

      {activeTab === "items" && (
        <div className="space-y-3">
          <div className="card-editorial p-3 space-y-2">
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="Item name..." value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="flex-1 min-w-[120px]" />
              <select value={newItemCat} onChange={(e) => setNewItemCat(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={newItemSupplier} onChange={(e) => setNewItemSupplier(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Vendor</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Input type="number" placeholder="Price" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} className="w-20" />
              <Input placeholder="Unit" value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value)} className="w-16" />
              <Button onClick={addItem} disabled={!newItemName.trim()} size="sm"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="card-editorial overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted-foreground uppercase border-b border-border"><th className="text-left px-4 py-2 font-medium">Name</th><th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Category</th><th className="text-right px-4 py-2 font-medium">Price</th><th className="w-10"></th></tr></thead>
              <tbody>{items.map(item => {
                const cat = categories.find(c => c.id === item.category_id);
                return (
                  <tr key={item.id} className="border-b border-border/40"><td className="px-4 py-2">{item.name}</td><td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{cat?.name ?? "—"}</td><td className="px-4 py-2 text-right">{item.default_unit_price != null ? <MoneyLabel amount={item.default_unit_price} suffix="" smallClassName="text-[0.8em]" /> : "—"}/{item.unit}</td><td className="px-2 py-2"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItem(item.id)}><Trash2 className="h-3 w-3" /></Button></td></tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {(activeTab === "orderCats" || activeTab === "orderIngs") && user && (
        <OrderCatalogAdmin
          userId={user.id}
          mode={activeTab === "orderCats" ? "categories" : "ingredients"}
        />
      )}
    </div>
  );
}
